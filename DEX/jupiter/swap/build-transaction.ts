import axios from "axios";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import dotenv from "dotenv";
import type { QuoteParams } from "./quote.ts";
import { getSwapQuote } from "./quote.ts";

dotenv.config();
// 优先级级别接口
export interface PriorityLevelWithMaxLamports {
  priorityLevel: "medium" | "high" | "veryHigh";
  maxLamports: number; // 最大lamports，防止优先费用过高
}

// 优先费用参数接口
export interface PrioritizationFeeLamports {
  //两个参数一起使用的话，需要用swap instruction的方式来构建交易
  priorityLevelWithMaxLamports?: PriorityLevelWithMaxLamports;
  jitoTipLamports?: number; // Jito tip金额，   这个要配合jito rpc一起使用。
}

// 构建交易的参数接口
export interface SwapTransactionParams {
  // 必需参数
  quoteResponse: any; // 从 quote API 获取的完整响应
  userPublicKey: string; // 用户钱包公钥

  // 可选参数
  wrapAndUnwrapSol?: boolean; // 是否包装/解包装 SOL，默认 true
  useSharedAccounts?: boolean; // 是否使用共享账户，默认由路由引擎动态决定
  feeAccount?: string; // 费用收集账户（mint必须是输入或输出代币）
  trackingAccount?: string; // 跟踪账户，用于追踪交易

  // 优先费用设置（可以是优先级别或Jito tip，但不能同时使用）
  prioritizationFeeLamports?: PrioritizationFeeLamports;

  asLegacyTransaction?: boolean; // 构建为传统交易，默认 false
  destinationTokenAccount?: string; // 目标代币账户（如果提供，假设已初始化）
  dynamicComputeUnitLimit?: boolean; // 动态计算单元限制，默认 false
  skipUserAccountsRpcCalls?: boolean; // 跳过用户账户 RPC 调用，默认 false
  dynamicSlippage?: boolean; // 动态滑点，默认 false，启用后会覆盖询价里面的slippageBps设置
  computeUnitPriceMicroLamports?: number; // 精确的计算单元价格（微 lamports）
  blockhashSlotsToExpiry?: number; // 交易有效期（槽数），如果传入 10 个 slot，交易将在到期前有效期约为 400ms * 10 = 大约 4 秒
}

// 构建 Jupiter swap 交易
export async function buildSwapTransaction(
  params: SwapTransactionParams
): Promise<any> {
  const requestBody = {
    // 必需参数
    quoteResponse: params.quoteResponse,
    userPublicKey: params.userPublicKey,

    // 可选参数，只添加非 undefined 的值
    ...(params.wrapAndUnwrapSol !== undefined && {
      wrapAndUnwrapSol: params.wrapAndUnwrapSol,
    }),
    ...(params.useSharedAccounts !== undefined && {
      useSharedAccounts: params.useSharedAccounts,
    }),
    ...(params.feeAccount && { feeAccount: params.feeAccount }),
    ...(params.trackingAccount && { trackingAccount: params.trackingAccount }),
    ...(params.prioritizationFeeLamports && {
      prioritizationFeeLamports: params.prioritizationFeeLamports,
    }),
    ...(params.asLegacyTransaction !== undefined && {
      asLegacyTransaction: params.asLegacyTransaction,
    }),
    ...(params.destinationTokenAccount && {
      destinationTokenAccount: params.destinationTokenAccount,
    }),
    ...(params.dynamicComputeUnitLimit !== undefined && {
      dynamicComputeUnitLimit: params.dynamicComputeUnitLimit,
    }),
    ...(params.skipUserAccountsRpcCalls !== undefined && {
      skipUserAccountsRpcCalls: params.skipUserAccountsRpcCalls,
    }),
    ...(params.dynamicSlippage !== undefined && {
      dynamicSlippage: params.dynamicSlippage,
    }),
    ...(params.computeUnitPriceMicroLamports !== undefined && {
      computeUnitPriceMicroLamports: params.computeUnitPriceMicroLamports,
    }),
    ...(params.blockhashSlotsToExpiry !== undefined && {
      blockhashSlotsToExpiry: params.blockhashSlotsToExpiry,
    }),
  };

  const config = {
    method: "post",
    maxBodyLength: Infinity,
    url: "https://lite-api.jup.ag/swap/v1/swap",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    data: JSON.stringify(requestBody),
  };

  try {
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.error("构建交易失败:", error);
    throw error;
  }
}

// 获取 Swap Instructions (返回分解的指令而不是完整交易)
export async function getSwapInstructions(
  params: SwapTransactionParams
): Promise<any> {
  const requestBody = {
    quoteResponse: params.quoteResponse,
    userPublicKey: params.userPublicKey,

    ...(params.wrapAndUnwrapSol !== undefined && {
      wrapAndUnwrapSol: params.wrapAndUnwrapSol,
    }),
    ...(params.useSharedAccounts !== undefined && {
      useSharedAccounts: params.useSharedAccounts,
    }),
    ...(params.feeAccount && { feeAccount: params.feeAccount }),
    ...(params.trackingAccount && { trackingAccount: params.trackingAccount }),
    ...(params.prioritizationFeeLamports && {
      prioritizationFeeLamports: params.prioritizationFeeLamports,
    }),
    ...(params.asLegacyTransaction !== undefined && {
      asLegacyTransaction: params.asLegacyTransaction,
    }),
    ...(params.destinationTokenAccount && {
      destinationTokenAccount: params.destinationTokenAccount,
    }),
    ...(params.dynamicComputeUnitLimit !== undefined && {
      dynamicComputeUnitLimit: params.dynamicComputeUnitLimit,
    }),
    ...(params.skipUserAccountsRpcCalls !== undefined && {
      skipUserAccountsRpcCalls: params.skipUserAccountsRpcCalls,
    }),
    ...(params.dynamicSlippage !== undefined && {
      dynamicSlippage: params.dynamicSlippage,
    }),
    ...(params.computeUnitPriceMicroLamports !== undefined && {
      computeUnitPriceMicroLamports: params.computeUnitPriceMicroLamports,
    }),
    ...(params.blockhashSlotsToExpiry !== undefined && {
      blockhashSlotsToExpiry: params.blockhashSlotsToExpiry,
    }),
  };

  const config = {
    method: "post",
    maxBodyLength: Infinity,
    url: "https://lite-api.jup.ag/swap/v1/swap-instructions",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    data: JSON.stringify(requestBody),
  };

  try {
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.error("获取交换指令失败:", error);
    throw error;
  }
}

// 示例使用
async function main() {
  console.log("=== Jupiter Swap 统一演示 ===\n");

  // 1. 检查环境变量
  const userWallet = process.env.DEV_ADDRESS1;
  if (!userWallet) {
    console.error("❌ 错误: DEV_ADDRESS1 环境变量未设置");
    return;
  }
  console.log("✅ 使用钱包地址:", userWallet);

  // 2. 设置交易参数
  const inputMint = "So11111111111111111111111111111111111111112"; // SOL
  const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
  const amount = 1;

  try {
    // 3. 获取报价
    const quoteParams: QuoteParams = {
      inputMint: inputMint,
      outputMint: outputMint,
      amount: amount,
      slippageBps: 50,
      swapMode: "ExactIn",
    };

    const quote = await getSwapQuote(quoteParams);

    // 4. 通用参数配置
    const commonParams: SwapTransactionParams = {
      quoteResponse: quote,
      userPublicKey: userWallet,
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          priorityLevel: "medium",
          maxLamports: 100000,
        },
      },
    };

    console.log(`\n=== 第二步: 演示两种构建方式 ===`);

    // 方式1: 直接构建完整交易
    console.log("\n🔧 方式1: 构建完整交易 (/swap)");
    const swapTransaction = await buildSwapTransaction(commonParams);
    console.log(JSON.stringify(swapTransaction, null, 2));

    // 方式2: 获取分解指令
    console.log("\n🔧 方式2: 获取分解指令 (/swap-instructions)");
    const swapInstructions = await getSwapInstructions(commonParams);
    
    // 格式化输出 JSON，第二个参数是替换函数(null表示不替换)，第三个参数是缩进空格数
    console.log(JSON.stringify(swapInstructions, null, 2));
  } catch (error) {
    console.error("\n❌ 操作失败:", error.message || error);
    if (error.response?.data) {
      console.error("API 错误详情:", error.response.data);
    }
  }
}

main().catch(console.error);
