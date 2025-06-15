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

// 示例使用
async function main() {
  const userWallet = process.env.DEV_ADDRESS1;

  // 2. 设置交易参数
  const inputMint = "So11111111111111111111111111111111111111112"; // SOL
  const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
  const amount = 1;

  console.log(`\n=== 第一步: 获取报价 ===`);
  console.log(`输入代币: ${inputMint} (SOL)`);
  console.log(`输出代币: ${outputMint} (USDC)`);
  console.log(`交换数量: ${amount} SOL`);

  // 3. 调用 quote 函数获取报价
  const quoteParams: QuoteParams = {
    inputMint: inputMint,
    outputMint: outputMint,
    amount: amount,
    slippageBps: 50, // 0.5% 滑点
  };

  try {
    const quote = await getSwapQuote(quoteParams);

    console.log(`\n=== 第二步: 构建交易 ===`);

    // 4. 构建交易参数
    const transactionParams: SwapTransactionParams = {
      quoteResponse: quote,
      userPublicKey: userWallet,
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          priorityLevel: "medium",
          maxLamports: 100000, // 最大 0.0001 SOL
        },
      },
      asLegacyTransaction: false,
      dynamicComputeUnitLimit: true,
    };

    const swapTransactionResponse = await buildSwapTransaction(
      transactionParams
    );

    console.log("\n📋 交易响应信息:");
    console.log(swapTransactionResponse);
  } catch (error) {
    console.error("\n❌ 操作失败:", error.message || error);
  }
}

main().catch(console.error);
