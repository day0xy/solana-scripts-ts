import {
  Connection,
  PublicKey,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { connection, sleep } from "../辅助功能/1.辅助功能.ts";
import { batchGetWalletBalance } from "../钱包管理/2.余额查询.ts";
import bs58 from "bs58";
import dotenv from "dotenv";

dotenv.config();

const fromSecretKey = bs58.decode(process.env.DEV_PRIVATEKEY1);
const fromWallet = Keypair.fromSecretKey(fromSecretKey);

const toAddress = new PublicKey("93rJ8i5GfqYADUuhTimK3FruQ9Fq43auPZQkAts2WdfT");

export async function executeV0Transaction(
  payer: Keypair,
  instruction: TransactionInstruction[],
  lookupTableAccount?: AddressLookupTableAccount[]
) {
  const { blockhash } = await connection.getLatestBlockhash();

  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: instruction,
  }).compileToV0Message(lookupTableAccount);

  const transaction = new VersionedTransaction(messageV0);

  transaction.sign([payer]);

  // 模拟交易
  const simulateResult = await connection.simulateTransaction(transaction);
  console.log("模拟交易结果: ", simulateResult);

  // 发送交易
  const signature = await connection.sendTransaction(transaction);
  console.log(`交易已发送: https://solscan.io/tx/${signature}?cluster=devnet`);
}

export async function createALT(payer: Keypair) {
  const slot = await connection.getSlot("confirmed");

  const [lookupTableInstruction, lookupTableAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: payer.publicKey,
      payer: payer.publicKey,
      recentSlot: slot,
    });

  console.log("lookup table address:", lookupTableAddress.toBase58());
  //调用v0交易执行函数
  executeV0Transaction(payer, [lookupTableInstruction]);
}

export async function addAddressToALT(
  lookupTableAddress: PublicKey,
  payer: Keypair,
  addresses: PublicKey[]
) {
  const extendInstruction = AddressLookupTableProgram.extendLookupTable({
    lookupTable: lookupTableAddress,
    authority: payer.publicKey,
    payer: payer.publicKey,
    addresses: addresses,
  });

  executeV0Transaction(payer, [extendInstruction]);
}

// 获取ALT表中的所有地址
export async function getALTAddresses(
  lookupTableAddress: PublicKey
): Promise<PublicKey[]> {
  try {
    const lookupTableAccount = await connection.getAddressLookupTable(
      lookupTableAddress
    );

    if (!lookupTableAccount.value) {
      throw new Error("地址查找表不存在");
    }

    const addresses = lookupTableAccount.value.state.addresses;

    addresses.forEach((address, index) => {
      console.log(`${index}: ${address.toBase58()}`);
    });

    return addresses;
  } catch (error) {
    console.error("获取ALT地址失败:", error);
    throw error;
  }
}

// 检查地址是否在ALT表中
export async function isAddressInALT(
  lookupTableAddress: PublicKey,
  targetAddress: PublicKey
): Promise<{ isFound: boolean; index: number }> {
  try {
    const addresses = await getALTAddresses(lookupTableAddress);
    const index = addresses.findIndex((addr) => addr.equals(targetAddress));
    const isFound = index !== -1;

    console.log(
      `地址${isFound ? "存在" : "不存在"}${isFound ? `, 索引: ${index}` : ""}`
    );

    return { isFound, index };
  } catch (error) {
    console.error("检查地址失败:", error);
    throw error;
  }
}

async function main() {
  console.log("两个钱包余额");
  console.log(
    await batchGetWalletBalance([
      process.env.DEV_ADDRESS1,
      process.env.DEV_ADDRESS2,
    ])
  );

  const lookupTableAddress = new PublicKey(
    "Dv2KLFgzLgD1XSrQSgejkXqAYKZCRd44eUsQbt7ra8Pq"
  );
  const ALT = await connection.getAddressLookupTable(lookupTableAddress);
  const lookupTableAccount = ALT.value;

  if (!ALT.value) {
    throw new Error("地址查找表不存在");
  }

  console.log("lookupTableAccount:", lookupTableAccount);

  const instruction = SystemProgram.transfer({
    fromPubkey: fromWallet.publicKey,
    toPubkey: toAddress,
    lamports: 1000000000, // 1 sol
  });

  await executeV0Transaction(fromWallet, [instruction], [lookupTableAccount]);

  await sleep(2000);

  console.log("转账后两个钱包余额");
  console.log(
    await batchGetWalletBalance([
      process.env.DEV_ADDRESS1,
      process.env.DEV_ADDRESS2,
    ])
  );

  // const addresses = [
  //   fromWallet.publicKey,
  //   new PublicKey("93rJ8i5GfqYADUuhTimK3FruQ9Fq43auPZQkAts2WdfT"),
  //   SystemProgram.programId,
  // ];

  // await addAddressToALT(lookupj gTableAddress, fromWallet, addresses);
  // await getALTAddresses(lookupTableAddress);
}
// main().catch(console.error);
