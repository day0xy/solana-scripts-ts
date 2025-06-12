import { PublicKey } from "@solana/web3.js";

/**
 * 检查给定的字符串是否为有效的Solana地址（公钥）
 * @param address 要检查的地址字符串
 * @returns { isValid: boolean, error?: string } 返回验证结果和可选的错误信息
 */
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
