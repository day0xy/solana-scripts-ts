import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { isValidSolanaAddress, connection } from "../辅助功能/1.辅助功能.ts";

// 类型定义
export interface TransferTarget {
  address: string;
  amount: number;
}

export interface OneToManyParams {
  fromKeypair: Keypair;
  toAddresses: string[];
  transferMode: 'same' | 'random' | 'custom';
  amount?: number; // same模式使用
  minAmount?: number; // random模式使用
  maxAmount?: number; // random模式使用
  customAmounts?: number[]; // custom模式使用
  intervalMs?: number; // 转账间隔时间(毫秒)
  priorityFee?: number; // 优先费用
}

export interface TransferResult {
  success: boolean;
  signature?: string;
  error?: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  index: number;
}

export interface OneToManyTokenParams {
  fromKeypair: Keypair;
  tokenMint: string;
  toAddresses: string[];
  transferMode: 'same' | 'random' | 'custom';
  amount?: number; // same模式使用
  minAmount?: number; // random模式使用
  maxAmount?: number; // random模式使用
  customAmounts?: number[]; // custom模式使用
  intervalMs?: number; // 转账间隔时间(毫秒)
  priorityFee?: number; // 优先费用
  decimals?: number; // 代币精度，默认为9
}

// 生成随机金额
function generateRandomAmount(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(6));
}

// 验证转账参数
function validateOneToManyParams(params: OneToManyParams): string[] {
  const errors: string[] = [];
  
  if (!params.toAddresses || params.toAddresses.length === 0) {
    errors.push("目标地址列表不能为空");
  }
  
  // 验证地址格式
  params.toAddresses.forEach((address, index) => {
    const validation = isValidSolanaAddress(address);
    if (!validation.isValid) {
      errors.push(`地址 ${index + 1} 无效: ${validation.error}`);
    }
  });
  
  // 验证转账模式参数
  switch (params.transferMode) {
    case 'same':
      if (!params.amount || params.amount <= 0) {
        errors.push("相同数量模式需要指定有效的转账金额");
      }
      break;
      
    case 'random':
      if (!params.minAmount || !params.maxAmount || 
          params.minAmount <= 0 || params.maxAmount <= 0 ||
          params.minAmount >= params.maxAmount) {
        errors.push("随机数量模式需要指定有效的最小和最大金额(最小值 < 最大值)");
      }
      break;
      
    case 'custom':
      if (!params.customAmounts || params.customAmounts.length !== params.toAddresses.length) {
        errors.push("自定义数量模式需要提供与地址数量相等的金额数组");
      }
      if (params.customAmounts && params.customAmounts.some(amount => amount <= 0)) {
        errors.push("自定义金额必须大于0");
      }
      break;
      
    default:
      errors.push("无效的转账模式");
  }
  
  return errors;
}

// 验证代币转账参数
function validateOneToManyTokenParams(params: OneToManyTokenParams): string[] {
  const errors: string[] = [];
  
  if (!params.toAddresses || params.toAddresses.length === 0) {
    errors.push("目标地址列表不能为空");
  }
  
  // 验证代币地址
  const mintValidation = isValidSolanaAddress(params.tokenMint);
  if (!mintValidation.isValid) {
    errors.push(`代币地址无效: ${mintValidation.error}`);
  }
  
  // 验证目标地址格式
  params.toAddresses.forEach((address, index) => {
    const validation = isValidSolanaAddress(address);
    if (!validation.isValid) {
      errors.push(`地址 ${index + 1} 无效: ${validation.error}`);
    }
  });
  
  // 验证转账模式参数
  switch (params.transferMode) {
    case 'same':
      if (!params.amount || params.amount <= 0) {
        errors.push("相同数量模式需要指定有效的转账金额");
      }
      break;
      
    case 'random':
      if (!params.minAmount || !params.maxAmount || 
          params.minAmount <= 0 || params.maxAmount <= 0 ||
          params.minAmount >= params.maxAmount) {
        errors.push("随机数量模式需要指定有效的最小和最大金额(最小值 < 最大值)");
      }
      break;
      
    case 'custom':
      if (!params.customAmounts || params.customAmounts.length !== params.toAddresses.length) {
        errors.push("自定义数量模式需要提供与地址数量相等的金额数组");
      }
      if (params.customAmounts && params.customAmounts.some(amount => amount <= 0)) {
        errors.push("自定义金额必须大于0");
      }
      break;
      
    default:
      errors.push("无效的转账模式");
  }
  
  return errors;
}

// 一对多转账SOL
export async function oneToManySolTransfer(params: OneToManyParams): Promise<{
  results: TransferResult[];
  summary: {
    totalTransfers: number;
    successfulTransfers: number;
    failedTransfers: number;
    totalAmount: number;
    totalFees: number;
    executionTime: number;
  }
}> {
  console.log(`开始一对多转账: ${params.toAddresses.length} 个地址`);
  console.log(`转账模式: ${params.transferMode}`);
  
  const startTime = Date.now();
  const results: TransferResult[] = [];
  let totalFees = 0;
  
  // 验证参数
  const validationErrors = validateOneToManyParams(params);
  if (validationErrors.length > 0) {
    console.error("参数验证失败:");
    validationErrors.forEach(error => console.error(`  ${error}`));
    throw new Error("参数验证失败");
  }
  
  // 生成转账目标列表
  const targets: TransferTarget[] = [];
  
  for (let i = 0; i < params.toAddresses.length; i++) {
    let amount: number;
    
    switch (params.transferMode) {
      case 'same':
        amount = params.amount!;
        break;
      case 'random':
        amount = generateRandomAmount(params.minAmount!, params.maxAmount!);
        break;
      case 'custom':
        amount = params.customAmounts![i];
        break;
      default:
        throw new Error("无效的转账模式");
    }
    
    targets.push({
      address: params.toAddresses[i],
      amount: amount
    });
  }
  
  // 计算总金额并检查余额
  const totalAmount = targets.reduce((sum, target) => sum + target.amount, 0);
  const totalLamports = totalAmount * LAMPORTS_PER_SOL;
  const estimatedFees = params.toAddresses.length * 5000; // 估算手续费
  
  const balance = await connection.getBalance(params.fromKeypair.publicKey);
  if (balance < totalLamports + estimatedFees) {
    throw new Error(`余额不足: 需要 ${((totalLamports + estimatedFees) / LAMPORTS_PER_SOL).toFixed(6)} SOL, 当前 ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  }
  
  console.log(`发送方余额: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  console.log(`总转账金额: ${totalAmount.toFixed(6)} SOL`);
  console.log(`转账间隔: ${params.intervalMs || 0} 毫秒`);
  
  // 显示转账详情
  console.log("\n转账详情:");
  targets.forEach((target, index) => {
    const shortAddress = `${target.address.slice(0, 8)}...${target.address.slice(-8)}`;
    console.log(`  ${index + 1}. ${shortAddress} -> ${target.amount.toFixed(6)} SOL`);
  });
  
  console.log("\n开始执行转账...");
  
  // 逐笔转账
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const shortAddress = `${target.address.slice(0, 8)}...${target.address.slice(-8)}`;
    
    console.log(`转账 ${i + 1}/${targets.length}: ${shortAddress} (${target.amount.toFixed(6)} SOL)`);
    
    try {
      // 创建转账指令
      const instructions: TransactionInstruction[] = [];
      
      // 添加优先费用指令
      if (params.priorityFee && params.priorityFee > 0) {
        instructions.push(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: params.priorityFee,
          })
        );
      }
      
      // 添加转账指令
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: params.fromKeypair.publicKey,
          toPubkey: new PublicKey(target.address),
          lamports: target.amount * LAMPORTS_PER_SOL,
        })
      );
      
      // 创建交易
      const transaction = new Transaction().add(...instructions);
      transaction.feePayer = params.fromKeypair.publicKey;
      
      // 获取最新区块哈希
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      
      // 发送交易
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [params.fromKeypair],
        {
          commitment: "confirmed",
          maxRetries: 3,
        }
      );
      
      console.log(`  成功: ${signature.slice(0, 8)}...`);
      
      // 获取交易费用
      const txDetails = await connection.getTransaction(signature, {
        commitment: "confirmed",
      });
      const fee = txDetails?.meta?.fee || 0;
      totalFees += fee;
      
      results.push({
        success: true,
        signature,
        fromAddress: params.fromKeypair.publicKey.toBase58(),
        toAddress: target.address,
        amount: target.amount,
        index: i,
      });
      
    } catch (error) {
      console.error(`  失败:`, error);
      
      results.push({
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        fromAddress: params.fromKeypair.publicKey.toBase58(),
        toAddress: target.address,
        amount: target.amount,
        index: i,
      });
    }
    
    // 转账间隔
    if (params.intervalMs && params.intervalMs > 0 && i < targets.length - 1) {
      console.log(`  等待 ${params.intervalMs} 毫秒...`);
      await new Promise(resolve => setTimeout(resolve, params.intervalMs));
    }
  }
  
  const executionTime = Date.now() - startTime;
  const successfulTransfers = results.filter(r => r.success).length;
  const failedTransfers = results.filter(r => !r.success).length;
  const actualTotalAmount = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.amount, 0);
  
  const summary = {
    totalTransfers: targets.length,
    successfulTransfers,
    failedTransfers,
    totalAmount: actualTotalAmount,
    totalFees: totalFees / LAMPORTS_PER_SOL,
    executionTime,
  };
  
  // 打印总结
  console.log(`\n完成: 成功 ${successfulTransfers}/${targets.length}, 转账 ${actualTotalAmount.toFixed(6)} SOL, 手续费 ${summary.totalFees.toFixed(6)} SOL, 耗时 ${(executionTime / 1000).toFixed(2)} 秒`);
  
  return { results, summary };
}

// 一对多转账SPL代币
export async function oneToManyTokenTransfer(params: OneToManyTokenParams): Promise<{
  results: TransferResult[];
  summary: {
    totalTransfers: number;
    successfulTransfers: number;
    failedTransfers: number;
    totalAmount: number;
    totalFees: number;
    executionTime: number;
  }
}> {
  console.log(`开始一对多代币转账: ${params.toAddresses.length} 个地址`);
  console.log(`代币地址: ${params.tokenMint}`);
  console.log(`转账模式: ${params.transferMode}`);
  
  const startTime = Date.now();
  const results: TransferResult[] = [];
  let totalFees = 0;
  const decimals = params.decimals || 9;
  
  // 验证参数
  const validationErrors = validateOneToManyTokenParams(params);
  if (validationErrors.length > 0) {
    console.error("参数验证失败:");
    validationErrors.forEach(error => console.error(`  ${error}`));
    throw new Error("参数验证失败");
  }
  
  const mintPubkey = new PublicKey(params.tokenMint);
  
  // 获取发送方代币账户
  const fromTokenAccount = await getAssociatedTokenAddress(
    mintPubkey,
    params.fromKeypair.publicKey
  );
  
  try {
    const tokenAccount = await getAccount(connection, fromTokenAccount);
    console.log(`发送方代币余额: ${tokenAccount.amount.toString()}`);
  } catch (error) {
    throw new Error("发送方没有此代币账户或余额为0");
  }
  
  // 生成转账目标列表
  const targets: TransferTarget[] = [];
  
  for (let i = 0; i < params.toAddresses.length; i++) {
    let amount: number;
    
    switch (params.transferMode) {
      case 'same':
        amount = params.amount!;
        break;
      case 'random':
        amount = generateRandomAmount(params.minAmount!, params.maxAmount!);
        break;
      case 'custom':
        amount = params.customAmounts![i];
        break;
      default:
        throw new Error("无效的转账模式");
    }
    
    targets.push({
      address: params.toAddresses[i],
      amount: amount
    });
  }
  
  // 计算总金额
  const totalAmount = targets.reduce((sum, target) => sum + target.amount, 0);
  console.log(`总转账数量: ${totalAmount} tokens`);
  console.log(`转账间隔: ${params.intervalMs || 0} 毫秒`);
  
  // 显示转账详情
  console.log("\n转账详情:");
  targets.forEach((target, index) => {
    const shortAddress = `${target.address.slice(0, 8)}...${target.address.slice(-8)}`;
    console.log(`  ${index + 1}. ${shortAddress} -> ${target.amount} tokens`);
  });
  
  console.log("\n开始执行转账...");
  
  // 逐笔转账
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const shortAddress = `${target.address.slice(0, 8)}...${target.address.slice(-8)}`;
    
    console.log(`转账 ${i + 1}/${targets.length}: ${shortAddress} (${target.amount} tokens)`);
    
    try {
      const instructions: TransactionInstruction[] = [];
      
      // 添加优先费用指令
      if (params.priorityFee && params.priorityFee > 0) {
        instructions.push(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: params.priorityFee,
          })
        );
      }
      
      const toPubkey = new PublicKey(target.address);
      const toTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        toPubkey
      );
      
      // 检查目标是否有代币账户，没有则创建
      try {
        await getAccount(connection, toTokenAccount);
      } catch (error) {
        console.log(`  创建代币账户: ${shortAddress}`);
        instructions.push(
          createAssociatedTokenAccountInstruction(
            params.fromKeypair.publicKey, // payer
            toTokenAccount,
            toPubkey, // owner
            mintPubkey // mint
          )
        );
      }
      
      // 添加转账指令
      const transferAmount = BigInt(Math.floor(target.amount * Math.pow(10, decimals)));
      instructions.push(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          params.fromKeypair.publicKey,
          transferAmount
        )
      );
      
      // 创建交易
      const transaction = new Transaction().add(...instructions);
      transaction.feePayer = params.fromKeypair.publicKey;
      
      // 获取最新区块哈希
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      
      // 发送交易
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [params.fromKeypair],
        {
          commitment: "confirmed",
          maxRetries: 3,
        }
      );
      
      console.log(`  成功: ${signature.slice(0, 8)}...`);
      
      // 获取交易费用
      const txDetails = await connection.getTransaction(signature, {
        commitment: "confirmed",
      });
      const fee = txDetails?.meta?.fee || 0;
      totalFees += fee;
      
      results.push({
        success: true,
        signature,
        fromAddress: params.fromKeypair.publicKey.toBase58(),
        toAddress: target.address,
        amount: target.amount,
        index: i,
      });
      
    } catch (error) {
      console.error(`  失败:`, error);
      
      results.push({
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        fromAddress: params.fromKeypair.publicKey.toBase58(),
        toAddress: target.address,
        amount: target.amount,
        index: i,
      });
    }
    
    // 转账间隔
    if (params.intervalMs && params.intervalMs > 0 && i < targets.length - 1) {
      console.log(`  等待 ${params.intervalMs} 毫秒...`);
      await new Promise(resolve => setTimeout(resolve, params.intervalMs));
    }
  }
  
  const executionTime = Date.now() - startTime;
  const successfulTransfers = results.filter(r => r.success).length;
  const failedTransfers = results.filter(r => !r.success).length;
  const actualTotalAmount = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.amount, 0);
  
  const summary = {
    totalTransfers: targets.length,
    successfulTransfers,
    failedTransfers,
    totalAmount: actualTotalAmount,
    totalFees: totalFees / LAMPORTS_PER_SOL,
    executionTime,
  };
  
  // 打印总结
  console.log(`\n完成: 成功 ${successfulTransfers}/${targets.length}, 转账 ${actualTotalAmount} tokens, 手续费 ${summary.totalFees.toFixed(6)} SOL, 耗时 ${(executionTime / 1000).toFixed(2)} 秒`);
  
  return { results, summary };
}

// 示例使用
async function main() {
  // 示例1: SOL相同数量转账
  /*
  const result1 = await oneToManySolTransfer({
    fromKeypair: yourKeypair,
    toAddresses: [
      "地址1",
      "地址2", 
      "地址3"
    ],
    transferMode: 'same',
    amount: 0.1, // 每个地址转 0.1 SOL
    intervalMs: 1000, // 每笔转账间隔 1 秒
    priorityFee: 1000
  });
  */

  // 示例2: SOL随机数量转账
  /*
  const result2 = await oneToManySolTransfer({
    fromKeypair: yourKeypair,
    toAddresses: ["地址1", "地址2", "地址3"],
    transferMode: 'random',
    minAmount: 0.05, // 最小 0.05 SOL
    maxAmount: 0.15, // 最大 0.15 SOL
    intervalMs: 500,
    priorityFee: 1000
  });
  */

  // 示例3: SOL自定义数量转账
  /*
  const result3 = await oneToManySolTransfer({
    fromKeypair: yourKeypair,
    toAddresses: ["地址1", "地址2", "地址3"],
    transferMode: 'custom',
    customAmounts: [0.1, 0.2, 0.15], // 分别转账不同数量
    intervalMs: 2000,
    priorityFee: 1000
  });
  */

  // 示例4: 代币相同数量转账
  /*
  const result4 = await oneToManyTokenTransfer({
    fromKeypair: yourKeypair,
    tokenMint: "代币合约地址",
    toAddresses: ["地址1", "地址2", "地址3"],
    transferMode: 'same',
    amount: 100, // 每个地址转 100 tokens
    intervalMs: 1500,
    priorityFee: 2000,
    decimals: 9 // 代币精度
  });
  */

  // 示例5: 代币随机数量转账
  /*
  const result5 = await oneToManyTokenTransfer({
    fromKeypair: yourKeypair,
    tokenMint: "代币合约地址",
    toAddresses: ["地址1", "地址2", "地址3"],
    transferMode: 'random',
    minAmount: 50, // 最小 50 tokens
    maxAmount: 200, // 最大 200 tokens
    intervalMs: 1000,
    priorityFee: 2000,
    decimals: 6 // USDC精度为6
  });
  */

  // 示例6: 代币自定义数量转账
  /*
  const result6 = await oneToManyTokenTransfer({
    fromKeypair: yourKeypair,
    tokenMint: "代币合约地址",
    toAddresses: ["地址1", "地址2", "地址3"],
    transferMode: 'custom',
    customAmounts: [100, 250, 150], // 分别转账不同数量
    intervalMs: 2000,
    priorityFee: 2000,
    decimals: 9
  });
  */

  console.log("取消注释示例代码来测试一对多转账功能");
}

// 取消注释下面这行来运行示例
// main().catch(console.error);
