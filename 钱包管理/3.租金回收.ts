import {
  Keypair,
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createCloseAccountInstruction,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import bs58 from "bs58";

async function closeSplTokenAccount({
  connection,
  tokenAccountToClose,
  ownerKeypair,
  rentDestination,
  feePayerKeypair,
}) {
  const transaction = new Transaction().add(
    createCloseAccountInstruction(
      tokenAccountToClose,
      rentDestination,
      ownerKeypair.publicKey
    )
  );

  transaction.feePayer = feePayerKeypair.publicKey;
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash("confirmed")
  ).blockhash;

  const signers = [feePayerKeypair];

  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    signers
  );

  console.log(`  交易签名: ${signature}`);
  return signature;
}
