import {
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createCloseAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { isValidSolanaAddress, connection } from "../辅助功能/1.辅助功能.ts";

// 类型定义
interface CloseAccountParams {
  tokenAccountToClose: PublicKey;
  ownerKeypair: Keypair;
  rentDestination: PublicKey;
  feePayerKeypair: Keypair;
}

interface RentRecoveryParams {
  walletKeypairs: Keypair[];
  rentDestination: PublicKey;
  feePayerKeypair?: Keypair;
}

interface TokenAccountInfo {
  address: PublicKey;
  mint: PublicKey;
  owner: PublicKey;
  amount: bigint;
  rentLamports: number;
}

// 关闭SPL代币账户并回收租金
async function closeSplTokenAccount({
  tokenAccountToClose,
  ownerKeypair,
  rentDestination,
  feePayerKeypair,
}: CloseAccountParams): Promise<string | null> {
  try {
    // 检查账户是否存在
    const accountInfo = await connection.getAccountInfo(tokenAccountToClose);
    if (!accountInfo) {
      console.log(`  ❌ 账户不存在: ${tokenAccountToClose.toBase58()}`);
      return null;
    }

    // 检查账户余额
    const tokenAccount = await getAccount(connection, tokenAccountToClose);
    if (tokenAccount.amount > 0) {
      console.log(`  ⚠️  账户仍有余额 ${tokenAccount.amount} tokens，无法关闭`);
      return null;
    }

    console.log(`  🔄 正在关闭代币账户: ${tokenAccountToClose.toBase58()}`);

    const transaction = new Transaction().add(
      createCloseAccountInstruction(
        tokenAccountToClose,
        rentDestination,
        ownerKeypair.publicKey
      )
    );

    transaction.feePayer = feePayerKeypair.publicKey;
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;

    // 添加账户所有者签名
    const signers = [feePayerKeypair];
    if (
      ownerKeypair.publicKey.toBase58() !== feePayerKeypair.publicKey.toBase58()
    ) {
      signers.push(ownerKeypair);
    }

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      signers,
      {
        commitment: "confirmed",
        maxRetries: 3,
      }
    );

    console.log(`  ✅ 交易成功，签名: ${signature}`);
    return signature;
  } catch (error) {
    console.error(`  ❌ 关闭账户失败:`, error);
    return null;
  }
}

// 获取钱包的所有代币账户
async function getWalletTokenAccounts(
  walletPublicKey: PublicKey
): Promise<TokenAccountInfo[]> {
  try {
    const tokenAccounts = await connection.getTokenAccountsByOwner(
      walletPublicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    const accountInfos: TokenAccountInfo[] = [];

    for (const { pubkey, account } of tokenAccounts.value) {
      try {
        const tokenAccountInfo = await getAccount(connection, pubkey);
        const rentLamports = await connection.getMinimumBalanceForRentExemption(
          account.data.length
        );

        accountInfos.push({
          address: pubkey,
          mint: tokenAccountInfo.mint,
          owner: tokenAccountInfo.owner,
          amount: tokenAccountInfo.amount,
          rentLamports: rentLamports,
        });
      } catch (error) {
        console.warn(`  ⚠️  无法获取代币账户信息: ${pubkey.toBase58()}`);
      }
    }

    return accountInfos;
  } catch (error) {
    console.error(`获取代币账户失败:`, error);
    return [];
  }
}

// 批量租金回收主函数
export async function batchRentRecovery({
  walletKeypairs,
  rentDestination,
  feePayerKeypair,
}: RentRecoveryParams): Promise<void> {
  let totalRecovered = 0;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < walletKeypairs.length; i++) {
    const wallet = walletKeypairs[i];
    const feePayer = feePayerKeypair || wallet;

    console.log(
      `\n📝 处理钱包 ${i + 1}/${
        walletKeypairs.length
      }: ${wallet.publicKey.toBase58()}`
    );

    try {
      // 获取该钱包的所有代币账户
      const tokenAccounts = await getWalletTokenAccounts(wallet.publicKey);

      if (tokenAccounts.length === 0) {
        console.log("  📭 未找到代币账户");
        continue;
      }

      console.log(`  📋 找到 ${tokenAccounts.length} 个代币账户`);

      // 只关闭余额为0的代币账户
      const emptyAccounts = tokenAccounts.filter(
        (account) => account.amount === 0n
      );

      if (emptyAccounts.length === 0) {
        console.log("  ⚠️  所有代币账户都有余额，无法关闭");
        continue;
      }

      console.log(`  🎯 可回收账户数量: ${emptyAccounts.length}`);

      // 批量关闭空账户
      for (const tokenAccount of emptyAccounts) {
        const signature = await closeSplTokenAccount({
          tokenAccountToClose: tokenAccount.address,
          ownerKeypair: wallet,
          rentDestination,
          feePayerKeypair: feePayer,
        });

        if (signature) {
          totalRecovered += tokenAccount.rentLamports;
          successCount++;
        } else {
          errorCount++;
        }

        // 添加延迟避免速率限制
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`  ❌ 处理钱包失败:`, error);
      errorCount++;
    }
  }

  console.log(
    "\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
  console.log("📊 租金回收完成统计:");
  console.log(`✅ 成功回收: ${successCount} 个账户`);
  console.log(`❌ 失败: ${errorCount} 个账户`);
  console.log(
    `💰 总回收租金: ${(totalRecovered / LAMPORTS_PER_SOL).toFixed(6)} SOL`
  );
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
}

// 示例使用
async function main() {
  // 这里应该从其他地方导入已经创建好的钱包 Keypair 数组
  const walletKeypairs: Keypair[] = [
    // 在其他地方导入的钱包对象
    // wallet1, wallet2, ...
  ];

  // 租金接收地址
  const rentDestination = new PublicKey("您的租金接收地址");

  // 手续费支付者（可选）
  const feePayerKeypair = undefined; // 或者指定一个 Keypair 对象

  await batchRentRecovery({
    walletKeypairs,
    rentDestination,
    feePayerKeypair,
  });
}

// 取消注释下面这行来运行脚本
// main().catch(console.error);
