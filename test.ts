import {
  Connection,
  PublicKey,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  AddressLookupTableAccount,
  AddressLookupTableProgram,
} from "@solana/web3.js";
import fs from "fs";
import { isValidSolanaAddress, connection } from "./辅助功能/1.辅助功能.ts";
import bs58 from "bs58";
import dotenv from "dotenv";
import { recoverNested } from "@solana/spl-token";

dotenv.config();

const fromSecretKey = bs58.decode(process.env.DEV_PRIVATEKEY1);
const fromWallet = Keypair.fromSecretKey(fromSecretKey);

const toAddress = new PublicKey("93rJ8i5GfqYADUuhTimK3FruQ9Fq43auPZQkAts2WdfT");

async function createALT() {
  const slot = await connection.getSlot("confirmed");

  const [lookupTableInstruction, lookupTableAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: fromWallet.publicKey,
      payer: fromWallet.publicKey,
      recentSlot: slot,
    });

  console.log("lookup table address:", lookupTableAddress.toBase58());

  const { blockhash } = await connection.getLatestBlockhash();

  const messageV0 = new TransactionMessage({
    payerKey: fromWallet.publicKey,
    recentBlockhash: blockhash,
    instructions: [lookupTableInstruction],
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);

  transaction.sign([fromWallet]);
  // 模拟交易
  const simulateResult = await connection.simulateTransaction(transaction);
  console.log("模拟交易结果: ", simulateResult);

  // 发送交易
  const signature = await connection.sendTransaction(transaction);
  console.log(`交易已发送: https://solscan.io/tx/${signature}?cluster=devnet`);
}

async function main() {
  // //建立指令
  // const instruction = SystemProgram.transfer({
  //   fromPubkey: fromWallet.publicKey,
  //   toPubkey: toAddress,
  //   lamports: 1000000000,
  // });
  // const { blockhash } = await connection.getLatestBlockhash();
  // //构造消息
  // const messageV0 = new TransactionMessage({
  //   payerKey: fromWallet.publicKey,
  //   instructions: [instruction],
  //   recentBlockhash: blockhash,
  // }).compileToV0Message();
  // //构造交易
  // const transaction = new VersionedTransaction(messageV0);
  // transaction.sign([fromWallet]);
  // const simulateResult = await connection.simulateTransaction(transaction);
  // console.log("模拟交易结果：", simulateResult);
  // //发送交易
  // const signature = await connection.sendTransaction(transaction);
  // console.log(`交易已发送: https://solscan.io/tx/${signature}?cluster=devnet`);
}
createALT();
// main().catch(console.error);
