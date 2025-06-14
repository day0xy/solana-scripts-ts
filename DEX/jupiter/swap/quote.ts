//这里固定swapMode模式为exactIn

import axios from "axios";
import {
  isValidSolanaAddress,
  connection,
  getTokenInfo,
} from "../../../辅助功能/1.辅助功能.ts";

// 查询报价参数接口 - 完整版本
export interface QuoteParams {
  // 必需参数
  inputMint: string; // 输入代币地址
  outputMint: string; // 输出代币地址
  amount: number; // 原始金额(未考虑精度)

  // 可选参数
  slippageBps?: number; // 滑点(基点)
  swapMode?: "ExactIn" | "ExactOut"; // 交换模式，默认 ExactIn
  dexes?: string[]; // 指定使用的 DEX 列表
  excludeDexes?: string[]; // 排除的 DEX 列表
  restrictIntermediateTokens?: boolean; // 限制中间代币，默认 true
  onlyDirectRoutes?: boolean; // 仅直接路由，默认 false
  asLegacyTransaction?: boolean; // 使用传统交易，默认 false
  platformFeeBps?: number; // 平台费用(基点)
  maxAccounts?: number; // 最大账户数，默认 64
  dynamicSlippage?: boolean; // 动态滑点，默认 false
}

// 构建查询参数字符串
export async function buildQueryParams(params: QuoteParams): Promise<string> {
  const queryParams = new URLSearchParams();

  // 获取输入代币精度并计算原始金额
  const inputMintDecimals = (await getTokenInfo(params.inputMint)).decimals;
  const inputMintAmount = params.amount * Math.pow(10, inputMintDecimals);

  // 必需参数
  queryParams.append("inputMint", params.inputMint);
  queryParams.append("outputMint", params.outputMint);
  queryParams.append("amount", inputMintAmount.toString());
  queryParams.append("swapMode", params.swapMode || "ExactIn");

  // 可选参数
  if (params.slippageBps !== undefined) {
    queryParams.append("slippageBps", params.slippageBps.toString());
  }

  if (params.dexes && params.dexes.length > 0) {
    queryParams.append("dexes", params.dexes.join(","));
  }

  if (params.excludeDexes && params.excludeDexes.length > 0) {
    queryParams.append("excludeDexes", params.excludeDexes.join(","));
  }

  if (params.restrictIntermediateTokens !== undefined) {
    queryParams.append(
      "restrictIntermediateTokens",
      params.restrictIntermediateTokens.toString()
    );
  }

  if (params.onlyDirectRoutes !== undefined) {
    queryParams.append("onlyDirectRoutes", params.onlyDirectRoutes.toString());
  }

  if (params.asLegacyTransaction !== undefined) {
    queryParams.append(
      "asLegacyTransaction",
      params.asLegacyTransaction.toString()
    );
  }

  if (params.platformFeeBps !== undefined) {
    queryParams.append("platformFeeBps", params.platformFeeBps.toString());
  }

  if (params.maxAccounts !== undefined) {
    queryParams.append("maxAccounts", params.maxAccounts.toString());
  }

  if (params.dynamicSlippage !== undefined) {
    queryParams.append("dynamicSlippage", params.dynamicSlippage.toString());
  }

  return queryParams.toString();
}

// Jupiter API 查询报价函数
export async function getSwapQuote(params: QuoteParams): Promise<any> {
  const queryString = await buildQueryParams(params);

  const config = {
    method: "get",
    maxBodyLength: Infinity,
    // url: `https://quote-api.jup.ag/v6/quote?${queryString}`,
    url: `https://lite-api.jup.ag/swap/v1/quote?${queryString}`,
    headers: {
      Accept: "application/json",
    },
  };

  try {
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.error("获取报价失败:", error);
    throw error;
  }
}

async function main() {
  const inputMint = "So11111111111111111111111111111111111111112";
  const outputMint = "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN";
  const advancedParams: QuoteParams = {
    inputMint: inputMint,
    outputMint: outputMint,
    amount: 1,
    slippageBps: 50, // 0.5% 滑点
    swapMode: "ExactIn", // 精确输入模式
    onlyDirectRoutes: false, // 允许多跳路由
    restrictIntermediateTokens: true, // 限制中间代币
    maxAccounts: 64, // 最大账户数
  };

  try {
    const advancedQuote = await getSwapQuote(advancedParams);

    const outputMintDecimals = (await getTokenInfo(outputMint)).decimals;
    const outAmount =
      advancedQuote.outAmount / Math.pow(10, outputMintDecimals);
    console.log(`outAmount: ${outAmount}`);

    //这个是考虑了滑点之后的最小输出值
    const otherAmountThreshold =
      advancedQuote.otherAmountThreshold / Math.pow(10, outputMintDecimals);
    console.log(`otherAmountThreshold: ${otherAmountThreshold}`);

    console.log(JSON.stringify(advancedQuote, null, 2));
  } catch (error) {
    console.error("查询失败:", error);
  }
}

main().catch(console.error);
