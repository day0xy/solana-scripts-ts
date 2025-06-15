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

// 公共工具函数

// 格式化地址显示 (前8位...后8位)
function formatAddress(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

// 等待指定时间间隔
async function waitForInterval(intervalMs: number, currentIndex: number, totalCount: number): Promise<void> {
  if (intervalMs && intervalMs > 0 && currentIndex < totalCount - 1) {
    console.log(`  等待 ${intervalMs} 毫秒...`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

// 创建并发送交易的通用函数
async function createAndSendTransaction(
  instructions: TransactionInstruction[],
  payer: Keypair,
  priorityFee?: number
): Promise<{ signature: string; fee: number }> {
  const allInstructions: TransactionInstruction[] = [];
  
  // 添加优先费用指令
  if (priorityFee && priorityFee > 0) {
    allInstructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFee,
      })
    );
  }
  
  allInstructions.push(...instructions);
  
  // 创建交易
  const transaction = new Transaction().add(...allInstructions);
  transaction.feePayer = payer.publicKey;
  
  // 获取最新区块哈希
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  
  // 发送交易
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer],
    {
      commitment: "confirmed",
      maxRetries: 3,
    }
  );
  
  // 获取交易费用
  const txDetails = await connection.getTransaction(signature, {
    commitment: "confirmed",
  });
  const fee = txDetails?.meta?.fee || 0;
  
  return { signature, fee };
}

// 处理代币账户(ATA)的通用函数
async function handleTokenAccount(
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey,
  instructions: TransactionInstruction[]
): Promise<PublicKey> {
  const tokenAccount = await getAssociatedTokenAddress(mint, owner);
  
  try {
    await getAccount(connection, tokenAccount);
  } catch (error) {
    // 账户不存在，创建ATA指令
    instructions.push(
      createAssociatedTokenAccountInstruction(
        payer, // payer
        tokenAccount,
        owner, // owner
        mint // mint
      )
    );
  }
  
  return tokenAccount;
}

// 计算执行结果统计的通用函数
function calculateSummary(
  results: TransferResult[],
  startTime: number,
  totalFees: number,
  isToken: boolean = false,
  unit: string = "SOL"
): {
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  totalAmount: number;
  totalFees: number;
  executionTime: number;
} {
  const executionTime = Date.now() - startTime;
  const successfulTransfers = results.filter(r => r.success).length;
  const failedTransfers = results.filter(r => !r.success).length;
  const totalAmount = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.amount, 0);

  return {
    totalTransfers: results.length,
    successfulTransfers,
    failedTransfers,
    totalAmount,
    totalFees: totalFees / LAMPORTS_PER_SOL,
    executionTime,
  };
}

// 打印执行总结的通用函数
function printSummary(
  summary: {
    totalTransfers: number;
    successfulTransfers: number;
    failedTransfers: number;
    totalAmount: number;
    totalFees: number;
    executionTime: number;
  },
  isToken: boolean = false,
  unit: string = "SOL"
): void {
  const amountStr = isToken ? 
    `${summary.totalAmount} ${unit}` : 
    `${summary.totalAmount.toFixed(6)} ${unit}`;
    
  console.log(`\n完成: 成功 ${summary.successfulTransfers}/${summary.totalTransfers}, ` +
    `转账 ${amountStr}, 手续费 ${summary.totalFees.toFixed(6)} SOL, ` +
    `耗时 ${(summary.executionTime / 1000).toFixed(2)} 秒`);
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

// 归集转账参数接口
export interface CollectSolParams {
  fromKeypairs: Keypair[];
  toAddress: string;
  transferMode: 'all' | 'fixed' | 'reserve';
  fixedAmount?: number; // fixed模式使用
  reserveAmount?: number; // reserve模式：每个钱包保留的金额
  intervalMs?: number; // 转账间隔时间(毫秒)
  priorityFee?: number; // 优先费用
}

// 归集转账SPL代币参数接口
export interface CollectTokenParams {
  fromKeypairs: Keypair[];
  tokenMint: string;
  toAddress: string;
  transferMode: 'all' | 'fixed' | 'reserve';
  fixedAmount?: number; // fixed模式使用
  reserveAmount?: number; // reserve模式：每个钱包保留的代币数量
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

// 验证归集转账参数
function validateCollectSolParams(params: CollectSolParams): string[] {
  const errors: string[] = [];
  
  if (!params.fromKeypairs || params.fromKeypairs.length === 0) {
    errors.push("源钱包列表不能为空");
  }
  
  // 验证目标地址
  const toAddressValidation = isValidSolanaAddress(params.toAddress);
  if (!toAddressValidation.isValid) {
    errors.push(`目标地址无效: ${toAddressValidation.error}`);
  }
  
  // 验证转账模式参数
  switch (params.transferMode) {
    case 'fixed':
      if (!params.fixedAmount || params.fixedAmount <= 0) {
        errors.push("固定数量模式需要指定有效的转账金额");
      }
      break;
      
    case 'reserve':
      if (!params.reserveAmount || params.reserveAmount < 0) {
        errors.push("保留余额模式需要指定有效的保留金额");
      }
      break;
      
    case 'all':
      // all 模式不需要额外参数验证
      break;
      
    default:
      errors.push("无效的转账模式");
  }
  
  return errors;
}

// 验证代币归集转账参数
function validateCollectTokenParams(params: CollectTokenParams): string[] {
  const errors: string[] = [];
  
  if (!params.fromKeypairs || params.fromKeypairs.length === 0) {
    errors.push("源钱包列表不能为空");
  }
  
  // 验证代币地址
  const mintValidation = isValidSolanaAddress(params.tokenMint);
  if (!mintValidation.isValid) {
    errors.push(`代币地址无效: ${mintValidation.error}`);
  }
  
  // 验证目标地址
  const toAddressValidation = isValidSolanaAddress(params.toAddress);
  if (!toAddressValidation.isValid) {
    errors.push(`目标地址无效: ${toAddressValidation.error}`);
  }
  
  // 验证转账模式参数
  switch (params.transferMode) {
    case 'fixed':
      if (!params.fixedAmount || params.fixedAmount <= 0) {
        errors.push("固定数量模式需要指定有效的转账金额");
      }
      break;
      
    case 'reserve':
      if (!params.reserveAmount || params.reserveAmount < 0) {
        errors.push("保留余额模式需要指定有效的保留金额");
      }
      break;
      
    case 'all':
      // all 模式不需要额外参数验证
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
    const shortAddress = formatAddress(target.address);
    console.log(`  ${index + 1}. ${shortAddress} -> ${target.amount.toFixed(6)} SOL`);
  });
  
  console.log("\n开始执行转账...");
  
  // 逐笔转账
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const shortAddress = formatAddress(target.address);
    
    console.log(`转账 ${i + 1}/${targets.length}: ${shortAddress} (${target.amount.toFixed(6)} SOL)`);
    
    try {
      // 创建转账指令
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: params.fromKeypair.publicKey,
        toPubkey: new PublicKey(target.address),
        lamports: target.amount * LAMPORTS_PER_SOL,
      });
      
      // 创建并发送交易
      const { signature, fee } = await createAndSendTransaction(
        [transferInstruction],
        params.fromKeypair,
        params.priorityFee
      );
      
      console.log(`  成功: ${signature.slice(0, 8)}...`);
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
    await waitForInterval(params.intervalMs || 0, i, targets.length);
  }
  
  const summary = calculateSummary(results, startTime, totalFees);
  printSummary(summary, false, "SOL");
  
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
    const shortAddress = formatAddress(target.address);
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
      const toPubkey = new PublicKey(target.address);
      
      // 处理目标代币账户
      const toTokenAccount = await handleTokenAccount(
        mintPubkey,
        toPubkey,
        params.fromKeypair.publicKey,
        instructions
      );
      
      if (instructions.length > 0) {
        console.log(`  创建代币账户: ${shortAddress}`);
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
      
      // 创建并发送交易
      const { signature, fee } = await createAndSendTransaction(
        instructions,
        params.fromKeypair,
        params.priorityFee
      );
      
      console.log(`  成功: ${signature.slice(0, 8)}...`);
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
    await waitForInterval(params.intervalMs || 0, i, targets.length);
  }
  
  const summary = calculateSummary(results, startTime, totalFees, true, "tokens");
  printSummary(summary, true, "tokens");
  
  return { results, summary };
}

// 归集转账SOL (多对一)
export async function collectSolTransfer(params: CollectSolParams): Promise<{
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
  console.log(`开始SOL归集转账: ${params.fromKeypairs.length} 个钱包`);
  console.log(`目标地址: ${params.toAddress}`);
  console.log(`转账模式: ${params.transferMode}`);
  
  const startTime = Date.now();
  const results: TransferResult[] = [];
  let totalFees = 0;
  
  // 验证参数
  const validationErrors = validateCollectSolParams(params);
  if (validationErrors.length > 0) {
    console.error("参数验证失败:");
    validationErrors.forEach(error => console.error(`  ${error}`));
    throw new Error("参数验证失败");
  }
  
  const toPublicKey = new PublicKey(params.toAddress);
  const shortToAddress = `${params.toAddress.slice(0, 8)}...${params.toAddress.slice(-8)}`;
  
  console.log(`转账间隔: ${params.intervalMs || 0} 毫秒`);
  
  // 显示模式说明
  switch (params.transferMode) {
    case 'all':
      console.log("模式说明: 转移所有余额(扣除手续费)");
      break;
    case 'fixed':
      console.log(`模式说明: 每个钱包转账固定金额 ${params.fixedAmount} SOL`);
      break;
    case 'reserve':
      console.log(`模式说明: 每个钱包保留 ${params.reserveAmount} SOL，其余转出`);
      break;
  }
  
  console.log("\n开始执行归集转账...");
  
  // 逐个处理钱包
  for (let i = 0; i < params.fromKeypairs.length; i++) {
    const fromKeypair = params.fromKeypairs[i];
    const shortFromAddress = `${fromKeypair.publicKey.toBase58().slice(0, 8)}...${fromKeypair.publicKey.toBase58().slice(-8)}`;
    
    console.log(`钱包 ${i + 1}/${params.fromKeypairs.length}: ${shortFromAddress}`);
    
    try {
      // 获取钱包余额
      const balance = await connection.getBalance(fromKeypair.publicKey);
      const balanceInSol = balance / LAMPORTS_PER_SOL;
      
      console.log(`  当前余额: ${balanceInSol.toFixed(6)} SOL`);
      
      if (balance === 0) {
        console.log(`  跳过: 余额为0`);
        results.push({
          success: false,
          error: "余额为0",
          fromAddress: fromKeypair.publicKey.toBase58(),
          toAddress: params.toAddress,
          amount: 0,
          index: i,
        });
        continue;
      }
      
      // 计算转账金额
      let transferAmount: number;
      const estimatedFee = 5000; // 估算手续费 lamports
      
      switch (params.transferMode) {
        case 'all':
          // 转移所有余额，扣除手续费
          transferAmount = (balance - estimatedFee) / LAMPORTS_PER_SOL;
          if (transferAmount <= 0) {
            console.log(`  跳过: 余额不足支付手续费`);
            results.push({
              success: false,
              error: "余额不足支付手续费",
              fromAddress: fromKeypair.publicKey.toBase58(),
              toAddress: params.toAddress,
              amount: 0,
              index: i,
            });
            continue;
          }
          break;
          
        case 'fixed':
          transferAmount = params.fixedAmount!;
          if (balance < transferAmount * LAMPORTS_PER_SOL + estimatedFee) {
            console.log(`  跳过: 余额不足转账 ${transferAmount} SOL`);
            results.push({
              success: false,
              error: `余额不足转账 ${transferAmount} SOL`,
              fromAddress: fromKeypair.publicKey.toBase58(),
              toAddress: params.toAddress,
              amount: transferAmount,
              index: i,
            });
            continue;
          }
          break;
          
        case 'reserve':
          const reserveLamports = params.reserveAmount! * LAMPORTS_PER_SOL;
          transferAmount = (balance - reserveLamports - estimatedFee) / LAMPORTS_PER_SOL;
          if (transferAmount <= 0) {
            console.log(`  跳过: 扣除保留金额后余额不足`);
            results.push({
              success: false,
              error: "扣除保留金额后余额不足",
              fromAddress: fromKeypair.publicKey.toBase58(),
              toAddress: params.toAddress,
              amount: 0,
              index: i,
            });
            continue;
          }
          break;
          
        default:
          throw new Error("无效的转账模式");
      }
      
      console.log(`  转账金额: ${transferAmount.toFixed(6)} SOL -> ${shortToAddress}`);
      
      // 创建转账指令
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports: Math.floor(transferAmount * LAMPORTS_PER_SOL),
      });
      
      // 创建并发送交易
      const { signature, fee } = await createAndSendTransaction(
        [transferInstruction],
        fromKeypair,
        params.priorityFee
      );
      
      console.log(`  成功: ${signature.slice(0, 8)}...`);
      totalFees += fee;
      
      results.push({
        success: true,
        signature,
        fromAddress: fromKeypair.publicKey.toBase58(),
        toAddress: params.toAddress,
        amount: transferAmount,
        index: i,
      });
      
    } catch (error) {
      console.error(`  失败:`, error);
      
      results.push({
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        fromAddress: fromKeypair.publicKey.toBase58(),
        toAddress: params.toAddress,
        amount: 0,
        index: i,
      });
    }
    
    // 转账间隔
    await waitForInterval(params.intervalMs || 0, i, params.fromKeypairs.length);
  }
  
  const summary = calculateSummary(results, startTime, totalFees);
  printSummary(summary, false, "SOL");
  
  return { results, summary };
}

// 归集转账SPL代币 (多对一)
export async function collectTokenTransfer(params: CollectTokenParams): Promise<{
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
  console.log(`开始代币归集转账: ${params.fromKeypairs.length} 个钱包`);
  console.log(`代币地址: ${params.tokenMint}`);
  console.log(`目标地址: ${params.toAddress}`);
  console.log(`转账模式: ${params.transferMode}`);
  
  const startTime = Date.now();
  const results: TransferResult[] = [];
  let totalFees = 0;
  const decimals = params.decimals || 9;
  
  // 验证参数
  const validationErrors = validateCollectTokenParams(params);
  if (validationErrors.length > 0) {
    console.error("参数验证失败:");
    validationErrors.forEach(error => console.error(`  ${error}`));
    throw new Error("参数验证失败");
  }
  
  const mintPubkey = new PublicKey(params.tokenMint);
  const toPublicKey = new PublicKey(params.toAddress);
  const shortToAddress = formatAddress(params.toAddress);
  
  // 获取或创建目标代币账户
  const toTokenAccount = await getAssociatedTokenAddress(
    mintPubkey,
    toPublicKey
  );
  
  console.log(`转账间隔: ${params.intervalMs || 0} 毫秒`);
  
  // 显示模式说明
  switch (params.transferMode) {
    case 'all':
      console.log("模式说明: 转移所有代币余额");
      break;
    case 'fixed':
      console.log(`模式说明: 每个钱包转账固定数量 ${params.fixedAmount} tokens`);
      break;
    case 'reserve':
      console.log(`模式说明: 每个钱包保留 ${params.reserveAmount} tokens，其余转出`);
      break;
  }
  
  console.log("\n开始执行归集转账...");
  
  // 逐个处理钱包
  for (let i = 0; i < params.fromKeypairs.length; i++) {
    const fromKeypair = params.fromKeypairs[i];
    const shortFromAddress = formatAddress(fromKeypair.publicKey.toBase58());
    
    console.log(`钱包 ${i + 1}/${params.fromKeypairs.length}: ${shortFromAddress}`);
    
    try {
      // 获取发送方代币账户
      const fromTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        fromKeypair.publicKey
      );
      
      // 检查代币账户是否存在并获取余额
      let tokenBalance: bigint;
      try {
        const tokenAccount = await getAccount(connection, fromTokenAccount);
        tokenBalance = tokenAccount.amount;
      } catch (error) {
        console.log(`  跳过: 没有代币账户或余额为0`);
        results.push({
          success: false,
          error: "没有代币账户或余额为0",
          fromAddress: fromKeypair.publicKey.toBase58(),
          toAddress: params.toAddress,
          amount: 0,
          index: i,
        });
        continue;
      }
      
      const balanceInTokens = Number(tokenBalance) / Math.pow(10, decimals);
      console.log(`  当前余额: ${balanceInTokens} tokens`);
      
      if (tokenBalance === 0n) {
        console.log(`  跳过: 代币余额为0`);
        results.push({
          success: false,
          error: "代币余额为0",
          fromAddress: fromKeypair.publicKey.toBase58(),
          toAddress: params.toAddress,
          amount: 0,
          index: i,
        });
        continue;
      }
      
      // 计算转账数量
      let transferAmount: number;
      let transferAmountRaw: bigint;
      
      switch (params.transferMode) {
        case 'all':
          // 转移所有代币余额
          transferAmount = balanceInTokens;
          transferAmountRaw = tokenBalance;
          break;
          
        case 'fixed':
          transferAmount = params.fixedAmount!;
          transferAmountRaw = BigInt(Math.floor(transferAmount * Math.pow(10, decimals)));
          if (transferAmountRaw > tokenBalance) {
            console.log(`  跳过: 余额不足转账 ${transferAmount} tokens`);
            results.push({
              success: false,
              error: `余额不足转账 ${transferAmount} tokens`,
              fromAddress: fromKeypair.publicKey.toBase58(),
              toAddress: params.toAddress,
              amount: transferAmount,
              index: i,
            });
            continue;
          }
          break;
          
        case 'reserve':
          const reserveAmountRaw = BigInt(Math.floor(params.reserveAmount! * Math.pow(10, decimals)));
          transferAmountRaw = tokenBalance - reserveAmountRaw;
          if (transferAmountRaw <= 0n) {
            console.log(`  跳过: 扣除保留数量后余额不足`);
            results.push({
              success: false,
              error: "扣除保留数量后余额不足",
              fromAddress: fromKeypair.publicKey.toBase58(),
              toAddress: params.toAddress,
              amount: 0,
              index: i,
            });
            continue;
          }
          transferAmount = Number(transferAmountRaw) / Math.pow(10, decimals);
          break;
          
        default:
          throw new Error("无效的转账模式");
      }
      
      console.log(`  转账数量: ${transferAmount} tokens -> ${shortToAddress}`);
      
      // 创建转账指令
      const instructions: TransactionInstruction[] = [];
      
      // 处理目标代币账户
      await handleTokenAccount(
        mintPubkey,
        toPublicKey,
        fromKeypair.publicKey,
        instructions
      );
      
      if (instructions.length > 0) {
        console.log(`  创建目标代币账户: ${shortToAddress}`);
      }
      
      // 添加转账指令
      instructions.push(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromKeypair.publicKey,
          transferAmountRaw
        )
      );
      
      // 创建并发送交易
      const { signature, fee } = await createAndSendTransaction(
        instructions,
        fromKeypair,
        params.priorityFee
      );
      
      console.log(`  成功: ${signature.slice(0, 8)}...`);
      totalFees += fee;
      
      results.push({
        success: true,
        signature,
        fromAddress: fromKeypair.publicKey.toBase58(),
        toAddress: params.toAddress,
        amount: transferAmount,
        index: i,
      });
      
    } catch (error) {
      console.error(`  失败:`, error);
      
      results.push({
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        fromAddress: fromKeypair.publicKey.toBase58(),
        toAddress: params.toAddress,
        amount: 0,
        index: i,
      });
    }
    
    // 转账间隔
    await waitForInterval(params.intervalMs || 0, i, params.fromKeypairs.length);
  }
  
  const summary = calculateSummary(results, startTime, totalFees, true, "tokens");
  printSummary(summary, true, "tokens");
  
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

  // 示例7: SOL归集转账 - 全部转账
  /*
  const collectResult1 = await collectSolTransfer({
    fromKeypairs: [yourKeypair1, yourKeypair2, yourKeypair3],
    toAddress: "目标地址",
    transferMode: 'all',
    intervalMs: 1000,
    priorityFee: 1000
  });
  */

  // 示例8: SOL归集转账 - 固定金额转账
  /*
  const collectResult2 = await collectSolTransfer({
    fromKeypairs: [yourKeypair1, yourKeypair2, yourKeypair3],
    toAddress: "目标地址",
    transferMode: 'fixed',
    fixedAmount: 0.1, // 每个钱包转 0.1 SOL
    intervalMs: 1000,
    priorityFee: 1000
  });
  */

  // 示例9: SOL归集转账 - 保留余额转账
  /*
  const collectResult3 = await collectSolTransfer({
    fromKeypairs: [yourKeypair1, yourKeypair2, yourKeypair3],
    toAddress: "目标地址",
    transferMode: 'reserve',
    reserveAmount: 0.05, // 每个钱包保留 0.05 SOL
    intervalMs: 1000,
    priorityFee: 1000
  });
  */

  // 示例7: SOL归集转账 - 全部转账模式
  /*
  const result7 = await collectSolTransfer({
    fromKeypairs: [wallet1, wallet2, wallet3], // 多个源钱包
    toAddress: "目标归集地址",
    transferMode: 'all', // 转移所有余额
    intervalMs: 1000,
    priorityFee: 1000
  });
  */

  // 示例8: SOL归集转账 - 固定金额模式
  /*
  const result8 = await collectSolTransfer({
    fromKeypairs: [wallet1, wallet2, wallet3],
    toAddress: "目标归集地址", 
    transferMode: 'fixed',
    fixedAmount: 0.5, // 每个钱包转账 0.5 SOL
    intervalMs: 1500,
    priorityFee: 1000
  });
  */

  // 示例9: SOL归集转账 - 保留余额模式
  /*
  const result9 = await collectSolTransfer({
    fromKeypairs: [wallet1, wallet2, wallet3],
    toAddress: "目标归集地址",
    transferMode: 'reserve', 
    reserveAmount: 0.1, // 每个钱包保留 0.1 SOL，其余转出
    intervalMs: 2000,
    priorityFee: 1000
  });
  */

  // 示例10: SPL代币归集转账 - 全部转账模式
  /*
  const result10 = await collectTokenTransfer({
    fromKeypairs: [wallet1, wallet2, wallet3], // 多个源钱包
    tokenMint: "代币合约地址",
    toAddress: "目标归集地址",
    transferMode: 'all', // 转移所有代币余额
    intervalMs: 1000,
    priorityFee: 2000,
    decimals: 9 // 代币精度
  });
  */

  // 示例11: SPL代币归集转账 - 固定数量模式
  /*
  const result11 = await collectTokenTransfer({
    fromKeypairs: [wallet1, wallet2, wallet3],
    tokenMint: "代币合约地址",
    toAddress: "目标归集地址",
    transferMode: 'fixed',
    fixedAmount: 100, // 每个钱包转账 100 tokens
    intervalMs: 1500,
    priorityFee: 2000,
    decimals: 6 // USDC精度为6
  });
  */

  // 示例12: SPL代币归集转账 - 保留余额模式
  /*
  const result12 = await collectTokenTransfer({
    fromKeypairs: [wallet1, wallet2, wallet3],
    tokenMint: "代币合约地址", 
    toAddress: "目标归集地址",
    transferMode: 'reserve',
    reserveAmount: 50, // 每个钱包保留 50 tokens，其余转出
    intervalMs: 2000,
    priorityFee: 2000,
    decimals: 9
  });
  */

  console.log("取消注释示例代码来测试批量转账功能");
}


// main().catch(console.error);
