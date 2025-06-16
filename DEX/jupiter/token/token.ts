import axios from "axios";

export async function getTokenInfo(mintAddress: string): Promise<any | null> {
  try {
    // 参数验证
    if (!mintAddress || typeof mintAddress !== "string") {
      throw new Error("无效的mint地址");
    }

    const config = {
      method: "get" as const,
      maxBodyLength: Infinity,
      url: `https://lite-api.jup.ag/tokens/v1/token/${mintAddress}`,
      headers: {
        Accept: "application/json",
      },
      timeout: 10000, // 10秒超时
    };

    const response = await axios.request(config);

    // 检查响应状态
    if (response.status !== 200) {
      console.warn(`⚠️ API响应状态异常: ${response.status}`);
      return null;
    }

    const tokenData = response.data;

    // 验证返回的数据结构
    if (!tokenData.address || !tokenData.symbol) {
      console.warn("⚠️ 返回的代币数据不完整");
      return null;
    }

    return tokenData;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.warn(`⚠️ 未找到代币信息: ${mintAddress}`);
      return null;
    }

    if (error.code === "ECONNABORTED") {
      console.error("❌ 请求超时");
    } else if (error.response) {
      console.error(
        `❌ API请求失败: ${error.response.status} - ${error.response.statusText}`
      );
    } else {
      console.error("❌ 获取代币信息失败:", error.message);
    }

    throw error;
  }
}

export async function getBatchTokenInfo(
  mintAddresses: string[],
  concurrency: number = 3
): Promise<Array<{ address: string; info: any | null }>> {
  const results: Array<{ address: string; info: any | null }> = [];

  // 分批处理，避免过多并发请求
  for (let i = 0; i < mintAddresses.length; i += concurrency) {
    const batch = mintAddresses.slice(i, i + concurrency);

    const batchPromises = batch.map(async (address) => {
      try {
        const info = await getTokenInfo(address);
        return { address, info };
      } catch (error) {
        console.warn(`⚠️ 获取代币 ${address} 信息失败:`, error.message);
        return { address, info: null };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // 避免API限流，批次间稍作延迟
    if (i + concurrency < mintAddresses.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

export function formatTokenInfo(tokenInfo: any): string {
  if (!tokenInfo) return "❌ 代币信息不可用";

  const lines = [
    `🪙 代币信息`,
    `├─ 名称: ${tokenInfo.name}`,
    `├─ 符号: ${tokenInfo.symbol}`,
    `├─ 地址: ${tokenInfo.address}`,
    `├─ 精度: ${tokenInfo.decimals}`,
  ];

  if (tokenInfo.created_at) {
    lines.push(
      `├─ 创建时间: ${new Date(tokenInfo.created_at).toLocaleString()}`
    );
  }

  if (tokenInfo.minted_at) {
    lines.push(
      `├─ 铸造时间: ${new Date(tokenInfo.minted_at).toLocaleString()}`
    );
  }

  if (tokenInfo.daily_volume !== null && tokenInfo.daily_volume !== undefined) {
    lines.push(`├─ 日交易量: ${tokenInfo.daily_volume.toLocaleString()}`);
  }

  if (tokenInfo.logoURI) {
    lines.push(`├─ Logo: ${tokenInfo.logoURI}`);
  }

  if (tokenInfo.tags && tokenInfo.tags.length > 0) {
    const validTags = tokenInfo.tags.filter((tag) => tag !== null);
    if (validTags.length > 0) {
      lines.push(`├─ 标签: ${validTags.join(", ")}`);
    }
  }

  if (tokenInfo.mint_authority) {
    lines.push(`├─ 铸造权限: ${tokenInfo.mint_authority}`);
  }

  if (tokenInfo.freeze_authority) {
    lines.push(`├─ 冻结权限: ${tokenInfo.freeze_authority}`);
  }

  if (tokenInfo.permanent_delegate) {
    lines.push(`├─ 永久委托: ${tokenInfo.permanent_delegate}`);
  }

  if (tokenInfo.extensions) {
    const ext = tokenInfo.extensions;
    if (ext.description) {
      lines.push(`├─ 描述: ${ext.description}`);
    }
    if (ext.website) {
      lines.push(`├─ 网站: ${ext.website}`);
    }
    if (ext.twitter) {
      lines.push(`├─ Twitter: ${ext.twitter}`);
    }
    if (ext.coingeckoId) {
      lines.push(`└─ CoinGecko ID: ${ext.coingeckoId}`);
    }
  }

  return lines.join("\n");
}

//根据池子地址获取交易对
export async function getMarketMints(marketAddress: string): Promise<any> {
  const config = {
    method: "get" as const,
    maxBodyLength: Infinity,
    url: `https://lite-api.jup.ag/tokens/v1/market/${marketAddress}/mints`,
    headers: {
      Accept: "application/json",
    },
  };

  try {
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.error("获取市场代币信息失败:", error);
    throw error;
  }
}

// 测试函数
async function main() {}

// main().catch(console.error);
