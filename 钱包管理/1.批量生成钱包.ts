import { Keypair, PublicKey } from "@solana/web3.js";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import * as fs from "fs";
import * as path from "path";
import bs58 from "bs58";

interface WalletInfo {
  index: number;
  publicKey: string;
  privateKey: number[];
  privateKeyBase58: string;
  mnemonic?: string;
  derivationPath?: string;
}

//生成随机钱包
function generateRandomWallet(index: number): WalletInfo {
  const keypair = Keypair.generate();

  return {
    index,
    publicKey: keypair.publicKey.toBase58(),
    privateKey: Array.from(keypair.secretKey),
    privateKeyBase58: bs58.encode(Buffer.from(keypair.secretKey))
  };
}

// 从助记词生成钱包
function generateWalletFromMnemonic(
  mnemonic: string,
  accountIndex: number = 0
): WalletInfo {
  const derivationPath = `m/44'/501'/${accountIndex}'/0'`;
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const derivedSeed = derivePath(derivationPath, seed.toString("hex")).key;
  const keypair = Keypair.fromSeed(derivedSeed);

  return {
    index: accountIndex,
    publicKey: keypair.publicKey.toBase58(),
    mnemonic,
    privateKey: Array.from(keypair.secretKey),
    privateKeyBase58: bs58.encode(Buffer.from(keypair.secretKey)),
    derivationPath,
  };
}

//批量生成随机钱包
function batchGenerateRandomWallets(count: number): WalletInfo[] {
  const wallets: WalletInfo[] = [];
  for (let i = 0; i < count; i++) {
    const wallet = generateRandomWallet(i + 1);
    wallets.push(wallet);
  }
  return wallets;
}

//从单个助记词批量生成钱包
function batchGenerateFromMnemonic(
  mnemonic: string,
  count: number
): WalletInfo[] {
  console.log(`🔧 正在从助记词批量生成 ${count} 个钱包...`);
  const wallets: WalletInfo[] = [];

  for (let i = 0; i < count; i++) {
    const wallet = generateWalletFromMnemonic(mnemonic, i);
    wallets.push(wallet);
    console.log(`✅ 钱包 ${i + 1} 生成完成`);
  }

  return wallets;
}

//批量生成助记词钱包，每个钱包都有独立的助记词
function batchGenerateWithUniqueMnemonics(count: number): WalletInfo[] {
  const wallets: WalletInfo[] = [];

  for (let i = 0; i < count; i++) {
    const mnemonic = bip39.generateMnemonic();
    const wallet = generateWalletFromMnemonic(mnemonic, 0);
    wallets.push(wallet);
  }
  return wallets;
}

// 显示钱包信息
function displayWalletInfo(wallet: WalletInfo): void {
  console.log(`\n💰 钱包 #${wallet.index}:`);
  console.log(`   地址: ${wallet.publicKey}`);
  if (wallet.mnemonic) {
    console.log(`   助记词: ${wallet.mnemonic}`);
  }
  console.log(`   私钥数组: [${wallet.privateKey.join(", ")}]`);
  console.log(`   私钥Base58: ${wallet.privateKeyBase58}`);
}
async function main() {
  console.log("🚀 Solana 批量钱包生成器");
  console.log("═".repeat(50));
  
  // 示例1: 生成3个随机钱包
  console.log("\n📝 示例1: 批量生成3个随机钱包");
  let count = 3;
  const randomWallets = batchGenerateRandomWallets(count);
  randomWallets.forEach((wallet) => displayWalletInfo(wallet));
  
  // 示例2: 从单个助记词生成多个钱包
  console.log("\n" + "═".repeat(50));
  console.log("\n📝 示例2: 从单个助记词生成3个钱包");
  const testMnemonic = bip39.generateMnemonic();
  console.log(`使用助记词: ${testMnemonic}`);
  const mnemonicWallets = batchGenerateFromMnemonic(testMnemonic, 3);
  mnemonicWallets.forEach((wallet) => displayWalletInfo(wallet));
  
  // 示例3: 生成带独立助记词的钱包
  console.log("\n" + "═".repeat(50));
  console.log("\n📝 示例3: 生成2个带独立助记词的钱包");
  const uniqueWallets = batchGenerateWithUniqueMnemonics(2);
  uniqueWallets.forEach((wallet) => displayWalletInfo(wallet));
  
  console.log("\n🎉 所有示例执行完成！");
}
// 如果直接运行此文件，则执行主函数
if (require.main === module) {
  main();
}

export {};
