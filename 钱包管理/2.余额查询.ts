import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { isValidSolanaAddress, connection } from "../辅助功能/1.辅助功能.ts";


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

//批量查询SOL余额
export async function batchGetWalletBalance(
  wallets: string[]
): Promise<{ [address: string]: number | null }> {
  const results: { [address: string]: number | null } = {};

  for (let i = 0; i < wallets.length; i++) {
    try {
      const solBalance = await getWalletBalance(wallets[i]);
      results[wallets[i]] = solBalance;
    } catch (error) {
      console.error(`获取钱包 ${wallets[i]} 余额失败:`, error);
      results[wallets[i]] = null;
    }
  }
  return results;
}

async function main() {
  // 测试钱包地址
  const testWallets = [
    "DNfuF1L62WWyW3pNakVkyGGFzVVhj4Yr52jSmdTyeBHm", // System Program (有效地址)
    "C3nLTNMK6Ao1s3J1CQhv8GbT3NoMmifWoi9PGEcYd9hP", // Wrapped SOL (有效地址)
  ];

  const balances = await batchGetWalletBalance(testWallets);

  let totalBalance = 0;
  let successCount = 0;
  let failedCount = 0;

  Object.entries(balances).forEach(([address, balance], index) => {

    if (balance !== null) {
      console.log(`${index + 1}. ${address} | ${balance.toFixed(6)} SOL`);
      totalBalance += balance;
      successCount++;
    } else {
      console.log(`${index + 1}. ${address} | 查询失败`);
      failedCount++;
    }
  });
}

// // 仅在 Node.js 环境中运行主函数
// if (
//   typeof require !== "undefined" &&
//   typeof module !== "undefined" &&
//   require.main === module
// ) {
//   main().catch(console.error);
// }
// main().catch(console.error);
