import { Deferrable, hexValue, resolveProperties } from "ethers/lib/utils";
import { JsonRpcProvider, TransactionRequest, TransactionResponse } from "@ethersproject/providers";
import { EntryPoint__factory, EntryPoint, UserOperationStruct } from "@account-abstraction/contracts";
import { Wallet, BigNumber } from "ethers";
import { SmartWallet } from "../modules/smart-wallet";
import { TransactionReceipt } from "@ethersproject/abstract-provider";
import axios from "axios";
import { BastionSignerOptions, BasicTransaction } from "../modules/bastionConnect";
import { createDummyTransactionReceipt } from "../helper";

const reportError = ({message, cause}: {message: string, cause: string}) => {
	throw new Error(message, {cause})
  }

const BASE_API_URL = "https://api.bastionwallet.io";
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

let options: BastionSignerOptions;
let entryPoint: EntryPoint;
let chainId: number;
let smartWallet: SmartWallet;
let initialized = false;

async function initializeIfNeeded(provider: JsonRpcProvider, newOptions?: BastionSignerOptions) {
	if (!initialized || options !== newOptions) {
		await initParams(provider, newOptions);
		initialized = true;
	}
}

async function initParams(provider: JsonRpcProvider, newOptions?: BastionSignerOptions) {
	options = newOptions;
	smartWallet = new SmartWallet();
	let signer;

	const network = await provider.getNetwork();
	chainId = network.chainId;

	try {
		const address = await provider.getSigner().getAddress();
		signer = provider.getSigner();
	} catch (e) {
		if(!options.privateKey)
			throw new Error("private key invalid/not provided")
		signer = new Wallet(options.privateKey, provider);
	}

	entryPoint = EntryPoint__factory.connect(ENTRY_POINT_ADDRESS, signer);
}

export async function createTransactionResponse(userOp1: UserOperationStruct, userOpHash: string, apiKey: string): Promise<TransactionResponse> {
	const userOp = await resolveProperties(userOp1);
	try {
		const headers = { "x-api-key": apiKey };
		// const axiosResponse = await axios.get(`${BASE_API_URL}/v1/transaction/receipt/${chainId}/${userOpHash}`, { headers });
		// const transactionReceipt = axiosResponse.data; // Extract the actual data
		const transactionReceipt = createDummyTransactionReceipt();
		return {
			hash: userOpHash,
			from: userOp.sender,
			confirmations: 0,
			nonce: BigNumber.from(userOp.nonce).toNumber(),
			gasLimit: BigNumber.from(userOp.callGasLimit),
			value: BigNumber.from(0),
			data: hexValue(userOp.callData),
			chainId: chainId,
			wait: async (): Promise<TransactionReceipt> => {
				return transactionReceipt;
			},
		};
	} catch (e) {
		throw new Error(`createTransactionResponse error: ${e.data.message}`);
	}
}

export async function batchTransactionRouting(provider: JsonRpcProvider, transactions: BasicTransaction[], options?: BastionSignerOptions): Promise<TransactionResponse> {
	try {
		await initializeIfNeeded(provider, options);

		const to: string[] = [];
		const value: number[] = [];
		const data: string[] = [];

		for (const transaction of transactions) {
			to.push(transaction.to as string);
			value.push(transaction.value ?? 0);
			data.push(transaction.data ?? "0x");
		}

		const userOperation = await smartWallet.prepareBatchTransaction(provider, to, data, value, options);
		let userOpToSign = userOperation;

		if (!options?.noSponsorship) {
			userOpToSign = options?.gasToken
				? await smartWallet.getPaymasterSponsorshipERC20(chainId, userOperation, options.gasToken, options.apiKey)
				: await smartWallet.getPaymasterSponsorship(chainId, userOperation, options?.apiKey || "");
		}

		const signedUserOperation = await smartWallet.signUserOperation(provider, userOpToSign, options);
		const res = await smartWallet.sendTransaction(provider, signedUserOperation, options);

		await new Promise((resolve) => setTimeout(resolve, 5000));
		return await createTransactionResponse(signedUserOperation, res.userOperationHash, options?.apiKey || "");
	} catch (error) {
		
		const errorType = error.message.split("~")[0]
		if(errorType == "PAYMENT_SPONSORSHIP_ERR_ERC20"){
			reportError({message : "Error while sending transaction through the bundler", cause: "BATCH_PAYMENT_SPONSORSHIP_ERR_ERC20"})
		}else if(errorType == "PAYMENT_SPONSORSHIP_ERR"){
			reportError({message : "Error while sending transaction through the bundler", cause : "BATCH_PAYMENT_SPONSORSHIP_ERR"})
		}else {
			console.error("Error in batchTransactionRouting:", error.message);
			throw new Error(`batchTransactionRouting error: ${error.message}`);
		}
	}
}

export async function transactionRouting(provider: JsonRpcProvider, transaction: Deferrable<TransactionRequest>, options?: BastionSignerOptions): Promise<TransactionResponse> {
	try {
		await initializeIfNeeded(provider, options);
		const transactionDefaults = {
			value: 0,
			data: "0x",
		};
		transaction = { ...transactionDefaults, ...transaction };

		const userOperation = await smartWallet.prepareTransaction(provider, transaction.to as string, transaction.value as number, options, transaction.data as string);

		let userOpToSign = userOperation;

		if (!options?.noSponsorship) {
			userOpToSign = options?.gasToken
				? await smartWallet.getPaymasterSponsorshipERC20(chainId, userOperation, options.gasToken, options.apiKey)
				: await smartWallet.getPaymasterSponsorship(chainId, userOperation, options?.apiKey || "");
		}

		const signedUserOperation = await smartWallet.signUserOperation(provider, userOpToSign, options);

		const res = await smartWallet.sendTransaction(provider, signedUserOperation, options);

		await new Promise((resolve) => setTimeout(resolve, 5000));
		return await createTransactionResponse(signedUserOperation, res.userOperationHash, options?.apiKey || "");
	} catch (error) {
		const errorType = error.message.split("~")[0]
		if(errorType == "PAYMENT_SPONSORSHIP_ERR_ERC20"){
			reportError({message : "Error while sending transaction through the bundler", cause: "PAYMENT_SPONSORSHIP_ERR_ERC20"})
		}else if(errorType == "PAYMENT_SPONSORSHIP_ERR"){
			reportError({message : "Error while sending transaction through the bundler", cause : "PAYMENT_SPONSORSHIP_ERR"})
		}else {
			console.error("Error in transactionRouting:", error.message);
			throw new Error(`transactionRouting error: ${error.message}`);
		}
	}
}

export async function getTransactionHash(provider: JsonRpcProvider, userOpHash: string, options?: BastionSignerOptions): Promise<string> {
	try {
		await initializeIfNeeded(provider, options);
		const chainId = options?.chainId ? options.chainId : (await provider.getNetwork()).chainId;
		const transactionHash = await smartWallet.getTransactionReceiptByUserOpHash(userOpHash, chainId, options?.apiKey || "");
		return transactionHash;
	} catch (error) {
		console.error("Error in getTransactionHash:", error.message);
		throw new Error(`getTransactionHash error: ${error.message}`);
	}
}

