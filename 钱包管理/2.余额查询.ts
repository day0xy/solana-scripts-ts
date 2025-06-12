import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { isValidSolanaAddress, connection } from "../辅助功能/1.辅助功能";

export async function getWalletBalance(wallet: string): Promise<number> {
  //做一个地址检查
  const result = isValidSolanaAddress(wallet);
  if (result.error) {
    console.log(`Error:${result.error}`);
  }
  const publicKey = new PublicKey(wallet);
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

export async function batchGetWalletBalance(
  wallets: string[],
  concurrent: number = 5
): Promise<{ [address: string]: number | null }> {
  const results: { [address: string]: number | null } = {};

  console.log(`开始批量查询 ${wallets.length} 个钱包的余额...`);

  // 分批处理以避免过多并发请求
  for (let i = 0; i < wallets.length; i += concurrent) {
    const batch = wallets.slice(i, i + concurrent);

    // 并发查询当前批次
    const batchPromises = batch.map(async (wallet) => {
      try {
        const balance = await getWalletBalance(wallet);
        results[wallet] = balance;
      } catch (error) {
        console.error(`获取钱包余额失败 (${wallet}):`, error);
        results[wallet] = null;
      }
    });

    await Promise.all(batchPromises);

    // 添加延迟以避免请求过于频繁
    if (i + concurrent < wallets.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const successful = Object.values(results).filter((v) => v !== null).length;
  const failed = Object.values(results).filter((v) => v === null).length;
  console.log(`批量查询完成: 成功 ${successful}，失败 ${failed}`);

  return results;
}

async function main() {
  // 测试钱包地址
  const testWallets = [
    "DNfuF1L62WWyW3pNakVkyGGFzVVhj4Yr52jSmdTyeBHm", // System Program (有效地址)
    "C3nLTNMK6Ao1s3J1CQhv8GbT3NoMmifWoi9PGEcYd9hP", // Wrapped SOL (有效地址)
  ];

  console.log("3. 测试批量余额查询:");
  try {
    const batchResults = await batchGetWalletBalance(testWallets, 2);

    console.log("批量查询结果:");
    Object.entries(batchResults).forEach(([address, balance]) => {
      if (balance !== null) {
        console.log(`✅ ${address}: ${balance.toFixed(4)} SOL`);
      } else {
        console.log(`❌ ${address}: 查询失败`);
      }
    });

    // 统计结果
    const successful = Object.values(batchResults).filter(
      (v) => v !== null
    ).length;
    const total = Object.keys(batchResults).length;
    console.log(`\n📊 批量查询统计: ${successful}/${total} 成功`);
  } catch (error) {
    console.log(`❌ 批量查询失败: ${error.message}`);
  }
}

// 仅在 Node.js 环境中运行主函数
if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module
) {
  main().catch(console.error);
}
