import axios from "axios";

// 常见代币信息
const TOKEN_INFO = {
  // SOL
  So11111111111111111111111111111111111111112: { symbol: "SOL", decimals: 9 },
  // USDC
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", decimals: 6 },
  // USDT
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: "USDT", decimals: 6 },
};

// 精度转换工具函数
export function toTokenAmount(humanAmount: number, decimals: number): number {
  return Math.floor(humanAmount * Math.pow(10, decimals));
}

export function fromTokenAmount(rawAmount: number, decimals: number): number {
  return rawAmount / Math.pow(10, decimals);
}

// 获取代币信息
export function getTokenInfo(mint: string) {
  return TOKEN_INFO[mint] || { symbol: "Unknown", decimals: 9 }; // 默认精度9
}

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
export function buildQueryParams(params: QuoteParams): string {
  const queryParams = new URLSearchParams();

  // 必需参数
  queryParams.append("inputMint", params.inputMint);
  queryParams.append("outputMint", params.outputMint);
  queryParams.append("amount", params.amount.toString());

  // 可选参数
  if (params.slippageBps !== undefined) {
    queryParams.append("slippageBps", params.slippageBps.toString());
  }

  if (params.swapMode) {
    queryParams.append("swapMode", params.swapMode);
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
  const queryString = buildQueryParams(params);

  const config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `https://quote-api.jup.ag/v6/quote?${queryString}`,
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

// 示例使用
async function main() {
  // 高级示例 - 使用更多参数
  const advancedParams: QuoteParams = {
    inputMint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
    outputMint: "So11111111111111111111111111111111111111112",
    amount: 145,
    slippageBps: 50, // 0.5% 滑点
    swapMode: "ExactIn", // 精确输入模式
    onlyDirectRoutes: false, // 允许多跳路由
    restrictIntermediateTokens: true, // 限制中间代币
    maxAccounts: 64, // 最大账户数
  };

  try {
    console.log("\n高级查询...");
    const advancedQuote = await getSwapQuote(advancedParams);
    console.log("高级报价:", JSON.stringify(advancedQuote, null, 2));
  } catch (error) {
    console.error("查询失败:", error);
  }
}

main().catch(console.error);
