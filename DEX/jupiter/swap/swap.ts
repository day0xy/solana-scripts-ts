import axios from "axios";
import {
  PublicKey,
  Transaction,
  VersionedTransaction,
  Connection,
  Keypair,
  TransactionSignature,
  SendOptions,
  TransactionInstruction,
} from "@solana/web3.js";
import type { QuoteParams } from "./quote.ts";
import { getSwapQuote } from "./quote.ts";
import dotenv from "dotenv";

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

// 反序列化交易函数
export function deserializeTransaction(
  swapTransactionData: any
): Transaction | VersionedTransaction {
  try {
    //先获取swapTransaction字段
    const { swapTransaction } = swapTransactionData;

    if (!swapTransaction) {
      throw new Error("交易数据中没有找到 swapTransaction 字段");
    }

    // 将 base64 编码的交易数据转换为 Buffer
    const transactionBuffer = Buffer.from(swapTransaction, "base64");

    // 尝试反序列化为 VersionedTransaction
    try {
      const versionedTransaction =
        VersionedTransaction.deserialize(transactionBuffer);

      return versionedTransaction;
    } catch (versionedError) {
      console.log("无法反序列化为 VersionedTransaction，尝试传统交易格式");

      // 如果失败，尝试反序列化为传统 Transaction
      try {
        const legacyTransaction = Transaction.from(transactionBuffer);
        console.log("✅ 成功反序列化为传统 Transaction");
        return legacyTransaction;
      } catch (legacyError) {
        throw new Error(
          `反序列化失败: VersionedTransaction error: ${versionedError.message}, Legacy Transaction error: ${legacyError.message}`
        );
      }
    }
  } catch (error) {
    console.error("❌ 反序列化交易失败:", error);
    throw error;
  }
}

export async function deserializeInstruction(
  instruction: TransactionInstruction
) {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((key) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: Buffer.from(instruction.data, "base64"),
  });
}

// 执行交易函数
export async function executeSwapTransaction(
  connection: Connection,
  transaction: Transaction | VersionedTransaction,
  signer: Keypair,
  options?: SendOptions
): Promise<TransactionSignature> {
  try {
    // 先签名
    if (transaction instanceof VersionedTransaction) {
      // VersionedTransaction 需要签名者数组
      transaction.sign([signer]);
    } else {
      // 传统 Transaction 直接传入单个签名者
      transaction.sign(signer);
    }
    const transactionBinary = transaction.serialize();
    const signature = await connection.sendRawTransaction(transactionBinary, {
      maxRetries: 2,
      skipPreflight: true,
    });

    console.log(`✅ 交易已发送，签名: ${signature}`);

    const latestBlockhash = await connection.getLatestBlockhash();

    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "confirmed"
    );

    if (confirmation.value.err) {
      throw new Error(
        `❌ 交易失败: ${JSON.stringify(
          confirmation.value.err
        )}\n🔗 Solscan 链接: https://solscan.io/tx/${signature}/`
      );
    } else {
      console.log(`🎉 交易确认成功! 签名: ${signature}`);
      console.log(`🔗 Solscan 链接: https://solscan.io/tx/${signature}/`);
    }

    return signature;
  } catch (error) {
    console.error("❌ 执行交易失败:", error);
    throw error;
  }
}

// 完整的交易流程：构建 -> 反序列化 -> 执行
export async function buildAndExecuteSwap(
  params: SwapTransactionParams,
  connection: Connection,
  signer: Keypair,
  executeOptions?: SendOptions
): Promise<TransactionSignature> {
  try {
    console.log("🔧 第1步: 构建交易...");
    const swapTransactionData = await buildSwapTransaction(params);

    console.log("🔄 第2步: 反序列化交易...");
    const transaction = deserializeTransaction(swapTransactionData);

    console.log("🚀 第3步: 执行交易...");
    const signature = await executeSwapTransaction(
      connection,
      transaction,
      signer,
      executeOptions
    );

    return signature;
  } catch (error) {
    console.error("❌ 完整交易流程失败:", error);
    throw error;
  }
}

// 示例使用
async function main() {
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
    console.log("📄 交易数据:", JSON.stringify(swapTransaction, null, 2));

    // 演示反序列化功能
    console.log("\n🔄 演示反序列化交易:");
    try {
      const deserializedTx = deserializeTransaction(swapTransaction);
      console.log(
        `✅ 反序列化成功，交易类型: ${
          deserializedTx instanceof VersionedTransaction
            ? "VersionedTransaction"
            : "Transaction"
        }`
      );

      // 如果需要执行交易，请取消下面的注释并提供私钥
      /*
      console.log("\n🚀 执行交易演示 (注释状态，需要私钥):");
      // 注意: 实际使用时需要提供真实的 Connection 和 Keypair
      const connection = new Connection("https://api.mainnet-beta.solana.com");
      const signer = Keypair.fromSecretKey(YOUR_SECRET_KEY_ARRAY);
      
      const signature = await executeSwapTransaction(connection, deserializedTx, signer);
      console.log("交易签名:", signature);
      
      // 或者使用一步到位的函数
      const signature2 = await buildAndExecuteSwap(commonParams, connection, signer);
      console.log("一步到位交易签名:", signature2);
      */
    } catch (deserializeError) {
      console.error("反序列化失败:", deserializeError.message);
    }

    // 方式2: 获取分解指令
    console.log("\n🔧 方式2: 获取分解指令 (/swap-instructions)");
    const swapInstructions = await getSwapInstructions(commonParams);
    console.log("📄 指令数据:", JSON.stringify(swapInstructions, null, 2));
  } catch (error) {
    console.error("\n❌ 操作失败:", error.message || error);
    if (error.response?.data) {
      console.error("API 错误详情:", error.response.data);
    }
  }
}

main().catch(console.error);
