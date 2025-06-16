/*
 * 辅助函数列表：
 * isValidSolanaAddress - 验证Solana地址是否有效
 * importWallet - 从私钥导入单个钱包
 * batchImportWallet - 私钥批量导入钱包
 * validatePrivateKey - 验证私钥格式是否正确
 * getTokenInfo - 获取代币详细信息（decimals、supply、权限等）
 * sleep - 延时函数
 */

import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import bs58 from "bs58";

import dotenv from "dotenv";

dotenv.config();

const helius_api_key = process.env.HELIUS_API_KEY;

const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${helius_api_key}`;
const devNet_RPCUrl = `https://devnet.helius-rpc.com/?api-key=${helius_api_key}`;
const testRpcUrl = "http://127.0.0.1:8899";

// export const connection = new Connection(rpcUrl, "confirmed");
// export const connection = new Connection(testRpcUrl, "confirmed");
export const connection = new Connection(devNet_RPCUrl, "confirmed");

export function isValidSolanaAddress(address: string): {
  isValid: boolean;
  error?: string;
} {
  // 检查输入是否为非空字符串
  if (!address || typeof address !== "string") {
    return { isValid: false, error: "Address must be a non-empty string" };
  }

  // 检查长度（base58编码的公钥通常为32-44字符）
  if (address.length < 32 || address.length > 44) {
    return {
      isValid: false,
      error: "Address length must be between 32 and 44 characters",
    };
  }

  try {
    // 尝试将字符串转换为PublicKey对象
    const publicKey = new PublicKey(address);

    // 验证PublicKey是否有效（检查是否为Ed25519曲线上的点）
    if (!PublicKey.isOnCurve(publicKey.toBuffer())) {
      return {
        isValid: false,
        error: "Address is not a valid Ed25519 public key",
      };
    }

    // 确认地址有效
    return { isValid: true };
  } catch (error) {
    // 捕获base58解码错误或格式错误
    return {
      isValid: false,
      error: `Invalid Solana address: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

//通过私钥导入钱包
export function importWallet(walletPrivateKey: string): Keypair {
  const privateKeyBytes = bs58.decode(walletPrivateKey);

  const keypair = Keypair.fromSecretKey(privateKeyBytes);

  return keypair;
}

export function batchImportWallet(walletPrivateKeys: string[]): Keypair[] {
  const keypairs: Keypair[] = [];

  for (let i = 0; i < walletPrivateKeys.length; i++) {
    try {
      const privateKey = walletPrivateKeys[i].trim();

      if (!privateKey) {
        console.log(`⚠️ 钱包 ${i + 1}: 私钥为空，跳过`);
        continue;
      }

      // 验证私钥格式
      const validationResult = validatePrivateKey(privateKey);
      if (!validationResult.isValid) {
        console.log(`❌ 钱包 ${i + 1}: ${validationResult.error}`);
        continue;
      }

      const keypair = importWallet(privateKey);
      keypairs.push(keypair);
      console.log(`✅ 钱包 ${i + 1} 导入成功: ${keypair.publicKey.toBase58()}`);
    } catch (error) {
      console.error(`❌ 钱包 ${i + 1} 导入失败:`, error.message);
    }
  }
  return keypairs;
}

// 验证私钥格式的辅助函数
export function validatePrivateKey(privateKey: string): {
  isValid: boolean;
  error?: string;
} {
  try {
    if (!privateKey || privateKey.length === 0) {
      return { isValid: false, error: "私钥不能为空" };
    }

    // 检查是否为有效的Base58格式
    const decoded = bs58.decode(privateKey);

    // Solana私钥应该是64字节
    if (decoded.length !== 64) {
      return {
        isValid: false,
        error: `私钥长度不正确，期望64字节，实际${decoded.length}字节`,
      };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: "私钥格式无效，请确保是有效的Base58编码" };
  }
}

// 代币信息返回接口
export interface TokenInfo {
  mint: string; // 代币地址
  decimals: number; // 精度
  supply: string; // 总供应量
  mintAuthority: PublicKey | null;
  freezeAuthority: PublicKey | null;
}

export async function getTokenInfo(mint: string): Promise<TokenInfo> {
  try {
    const mintPubkey = new PublicKey(mint);

    // 获取链上数据
    const onChainData = await getMint(connection, mintPubkey);

    // 构建返回对象
    const tokenInfo: TokenInfo = {
      mint: mint,
      decimals: onChainData.decimals,
      supply: onChainData.supply.toString(),
      mintAuthority: onChainData.mintAuthority,
      freezeAuthority: onChainData.freezeAuthority,
    };

    return tokenInfo;
  } catch (error) {
    console.error("获取代币信息失败:", error);
    throw error;
  }
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const mint = "So11111111111111111111111111111111111111112";
  const tokenInfo = await getTokenInfo(mint);
  console.log(tokenInfo.decimals);
}
