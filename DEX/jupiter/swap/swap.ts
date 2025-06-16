import axios from "axios";
import {
  PublicKey,
  Transaction,
  VersionedTransaction,
  Connection,
  Keypair,
  TransactionInstruction,
  TransactionMessage,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import type { QuoteParams } from "./quote.ts";
import { getSwapQuote } from "./quote.ts";
import { connection } from "../../../辅助功能/1.辅助功能.ts";
import bs58 from "bs58";
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

// 构建请求体的通用函数
function buildJupiterRequestBody(params: SwapTransactionParams): any {
  return {
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
}

// 发送Jupiter API请求的通用函数
async function sendJupiterRequest(
  params: SwapTransactionParams,
  endpoint: string
): Promise<any> {
  const requestBody = buildJupiterRequestBody(params);

  const config = {
    method: "post",
    maxBodyLength: Infinity,
    url: `https://lite-api.jup.ag/swap/v1/${endpoint}`,
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
    console.error(`Jupiter API请求失败 (${endpoint}):`, error);
    throw error;
  }
}

// 获取 Jupiter 序列化交易
export async function getSerializedTransaction(
  params: SwapTransactionParams
): Promise<any> {
  return sendJupiterRequest(params, "swap");
}

// 获取 Swap Instructions (返回分解的指令而不是完整交易)
export async function getSwapInstructions(
  params: SwapTransactionParams
): Promise<any> {
  return sendJupiterRequest(params, "swap-instructions");
}

// 反序列化交易函数
export function deserializeTransaction(
  swapTransactionData: any
): VersionedTransaction {
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
      console.log("无法反序列化为 VersionedTransaction");
    }
  } catch (error) {
    console.error("❌ 反序列化交易失败:", error);
    throw error;
  }
}

// 指令反序列化函数
export function deserializeInstruction(
  instruction: any
): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((key: any) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: Buffer.from(instruction.data, "base64"),
  });
}

// 获取地址查找表账户
export async function getAddressLookupTableAccounts(
  connection: Connection,
  keys: string[]
): Promise<AddressLookupTableAccount[]> {
  if (!keys || keys.length === 0) {
    return [];
  }

  const addressLookupTableAccountInfos =
    await connection.getMultipleAccountsInfo(
      keys.map((key) => new PublicKey(key))
    );

  return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
    const addressLookupTableAddress = keys[index];
    if (accountInfo) {
      const addressLookupTableAccount = new AddressLookupTableAccount({
        key: new PublicKey(addressLookupTableAddress),
        state: AddressLookupTableAccount.deserialize(accountInfo.data),
      });
      acc.push(addressLookupTableAccount);
    }
    return acc;
  }, new Array<AddressLookupTableAccount>());
}

// 构建完整的版本化交易（支持ALT压缩）
export async function buildVersionedTransaction(
  params: SwapTransactionParams,
  connection: Connection,
  payer: Keypair,
  includeInstructions?: {
    includeSetup?: boolean;
    includeCleanup?: boolean;
    includeComputeBudget?: boolean;
    includeTokenLedger?: boolean;
  }
): Promise<VersionedTransaction> {
  try {
    // 获取分解指令
    const instructions = await getSwapInstructions(params);

    if (instructions.error) {
      throw new Error("获取交换指令失败: " + instructions.error);
    }
    //解构赋值
    const {
      tokenLedgerInstruction,
      computeBudgetInstructions,
      setupInstructions,
      swapInstruction: swapInstructionPayload,
      cleanupInstruction,
      addressLookupTableAddresses,
    } = instructions;

    // 配置要包含的指令（默认全部包含）
    const config = {
      includeSetup: true,
      includeCleanup: true,
      includeComputeBudget: true,
      includeTokenLedger: true,
      ...includeInstructions,
    };

    // 构建指令列表
    const transactionInstructions: TransactionInstruction[] = [];

    // 添加计算预算指令
    if (config.includeComputeBudget && computeBudgetInstructions?.length > 0) {
      transactionInstructions.push(
        ...computeBudgetInstructions.map(deserializeInstruction)
      );
    }

    // 添加 Token Ledger 指令
    if (config.includeTokenLedger && tokenLedgerInstruction) {
      transactionInstructions.push(
        deserializeInstruction(tokenLedgerInstruction)
      );
    }

    // 添加设置指令（ATA创建等）
    if (config.includeSetup && setupInstructions?.length > 0) {
      transactionInstructions.push(
        ...setupInstructions.map(deserializeInstruction)
      );
    }

    // 添加核心交换指令
    if (swapInstructionPayload) {
      transactionInstructions.push(
        deserializeInstruction(swapInstructionPayload)
      );
    }

    // 添加清理指令（SOL解包装等）
    if (config.includeCleanup && cleanupInstruction) {
      transactionInstructions.push(deserializeInstruction(cleanupInstruction));
    }

    // 获取地址查找表账户
    const addressLookupTableAccounts = await getAddressLookupTableAccounts(
      connection,
      addressLookupTableAddresses || []
    );

    // 获取最新区块哈希
    const { blockhash } = await connection.getLatestBlockhash();

    // 构建版本化交易消息
    const messageV0 = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: transactionInstructions,
    }).compileToV0Message(addressLookupTableAccounts);

    // 创建版本化交易
    const transaction = new VersionedTransaction(messageV0);

    return transaction;
  } catch (error) {
    console.error("❌ 构建版本化交易失败:", error);
    throw error;
  }
}

// 执行交易函数
export async function executeSwapTransaction(
  connection: Connection,
  transaction: VersionedTransaction,
  signer: Keypair
): Promise<any> {
  try {
    transaction.sign([signer]);

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

// 执行版本化交易
export async function executeVersionedTransaction(
  connection: Connection,
  transaction: VersionedTransaction,
  signer: Keypair
): Promise<string> {
  try {
    // 签名交易
    transaction.sign([signer]);

    // 模拟交易
    const simulateResult = await connection.simulateTransaction(transaction);
    if (simulateResult.value.err) {
      console.warn("⚠️ 交易模拟警告:", simulateResult.value.err);
    }

    // 发送交易
    const signature = await connection.sendTransaction(transaction, {
      maxRetries: 2,
      skipPreflight: true,
    });

    console.log(`✅ 交易已发送，签名: ${signature}`);

    // 等待确认
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
      throw new Error(`❌ 交易失败: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log(`🎉 交易确认成功! 签名: ${signature}`);
    return signature;
  } catch (error) {
    console.error("❌ 执行版本化交易失败:", error);
    throw error;
  }
}

// 示例使用
async function main() {
  const userWallet = process.env.DEV_ADDRESS1;

  // 创建用户钱包 Keypair（用于签名）
  const fromSecretKey = bs58.decode(process.env.DEV_PRIVATEKEY1);
  const fromWallet = Keypair.fromSecretKey(fromSecretKey);

  const inputMint = "So11111111111111111111111111111111111111112"; // SOL
  const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
  const amount = 1;

  try {
    const quoteParams: QuoteParams = {
      inputMint: inputMint,
      outputMint: outputMint,
      amount: amount,
      slippageBps: 50,
      swapMode: "ExactIn",
    };

    const quote = await getSwapQuote(quoteParams);

    const commonParams: SwapTransactionParams = {
      quoteResponse: quote,
      userPublicKey: userWallet,
    };

    //  获取分解指令
    console.log("\n🔧 获取分解指令 (/swap-instructions)");
    const swapInstructions = await getSwapInstructions(commonParams);
    console.log(swapInstructions);

    //  构建V0交易
    console.log("\n🚀 构建V0交易");

    const versionedTx = await buildVersionedTransaction(
      commonParams,
      connection,
      fromWallet,
      {
        includeSetup: true,
        includeCleanup: true,
        includeComputeBudget: true,
        includeTokenLedger: false, // 通常不需要
      }
    );

    console.log("✅ 版本化交易构建:");
  } catch (error) {
    console.error("\n❌ 操作失败:", error.message || error);
    if (error.response?.data) {
      console.error("API 错误详情:", error.response.data);
    }
  }
}

main().catch(console.error);
