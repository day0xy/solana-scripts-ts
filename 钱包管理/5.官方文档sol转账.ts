import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection,
  TransactionInstruction,
  PublicKey,
} from "@solana/web3.js";

// Create a connection to cluster
const connection = new Connection("http://localhost:8899", "confirmed");

async function transferWithSystemProgram(
  connection: Connection,
  sender: Keypair,
  recipient: PublicKey,
  transferAmount: number
): Promise<string> {
  console.log("=== 使用 SystemProgram.transfer() 方法 ===");

  // Check balance before transfer
  const preBalance1 = await connection.getBalance(sender.publicKey);
  const preBalance2 = await connection.getBalance(recipient);

  console.log("转账前余额:");
  console.log("发送方:", preBalance1 / LAMPORTS_PER_SOL, "SOL");
  console.log("接收方:", preBalance2 / LAMPORTS_PER_SOL, "SOL");

  // Create a transfer instruction using SystemProgram.transfer()
  const transferInstruction = SystemProgram.transfer({
    fromPubkey: sender.publicKey,
    toPubkey: recipient,
    lamports: transferAmount * LAMPORTS_PER_SOL,
  });

  // Add the transfer instruction to a new transaction
  const transaction = new Transaction().add(transferInstruction);

  // Send the transaction to the network
  const transactionSignature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [sender]
  );

  // Check balance after transfer
  const postBalance1 = await connection.getBalance(sender.publicKey);
  const postBalance2 = await connection.getBalance(recipient);

  console.log("转账后余额:");
  console.log("发送方:", postBalance1 / LAMPORTS_PER_SOL, "SOL");
  console.log("接收方:", postBalance2 / LAMPORTS_PER_SOL, "SOL");
  console.log("交易签名:", transactionSignature);

  return transactionSignature;
}

// 底层方法：手动构建 TransactionInstruction
async function transferWithManualInstruction(
  connection: Connection,
  sender: Keypair,
  recipient: PublicKey,
  transferAmount: number
): Promise<string> {
  console.log("=== 使用手动构建 TransactionInstruction 方法 ===");

  // Check balance before transfer
  const preBalance1 = await connection.getBalance(sender.publicKey);
  const preBalance2 = await connection.getBalance(recipient);

  console.log("转账前余额:");
  console.log("发送方:", preBalance1 / LAMPORTS_PER_SOL, "SOL");
  console.log("接收方:", preBalance2 / LAMPORTS_PER_SOL, "SOL");

  // 在system program中，转账操作index是2
  const transferInstructionIndex = 2;

  // 创建指令数据缓冲区：4字节存储指令索引 + 8字节存储转账金额
  const instructionData = Buffer.alloc(4 + 8);
  instructionData.writeUInt32LE(transferInstructionIndex, 0);
  instructionData.writeBigUInt64LE(
    BigInt(transferAmount * LAMPORTS_PER_SOL),
    4
  );

  // 手动创建转账指令
  const transferInstruction = new TransactionInstruction({
    keys: [
      { pubkey: sender.publicKey, isSigner: true, isWritable: true }, // 发送方账户
      { pubkey: recipient, isSigner: false, isWritable: true }, // 接收方账户
    ],
    programId: SystemProgram.programId,
    data: instructionData,
  });

  // Add the transfer instruction to a new transaction
  const transaction = new Transaction().add(transferInstruction);

  // Send the transaction to the network
  const transactionSignature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [sender]
  );

  // Check balance after transfer
  const postBalance1 = await connection.getBalance(sender.publicKey);
  const postBalance2 = await connection.getBalance(recipient);

  console.log("转账后余额:");
  console.log("发送方:", postBalance1 / LAMPORTS_PER_SOL, "SOL");
  console.log("接收方:", postBalance2 / LAMPORTS_PER_SOL, "SOL");
  console.log("交易签名:", transactionSignature);

  return transactionSignature;
}

// 主函数：演示两种方法
async function main() {
  try {
    // Generate sender and recipient keypairs
    const sender = Keypair.generate();
    const recipient = Keypair.generate();

    console.log("发送方地址:", sender.publicKey.toBase58());
    console.log("接收方地址:", recipient.publicKey.toBase58());

    // Fund sender with airdrop
    console.log("\n正在为发送方空投 SOL...");
    const airdropSignature = await connection.requestAirdrop(
      sender.publicKey,
      2 * LAMPORTS_PER_SOL // 空投 2 SOL
    );
    await connection.confirmTransaction(airdropSignature, "confirmed");
    console.log("空投完成，签名:", airdropSignature);

    const transferAmount = 0.01; // 0.01 SOL

    // 方法1：使用 SystemProgram.transfer()
    console.log("\n" + "=".repeat(60));
    await transferWithSystemProgram(
      connection,
      sender,
      recipient.publicKey,
      transferAmount
    );

    // 等待一段时间
    console.log("\n等待 2 秒...\n");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 方法2：手动构建指令
    console.log("=".repeat(60));
    await transferWithManualInstruction(
      connection,
      sender,
      recipient.publicKey,
      transferAmount
    );
  } catch (error) {
    console.error("执行过程中发生错误:", error);
  }
}

// 运行主函数
main().catch(console.error);
