import { Deferrable, hexValue, resolveProperties } from "ethers/lib/utils";
import { JsonRpcProvider, TransactionRequest, TransactionResponse } from "@ethersproject/providers";
import { EntryPoint__factory, EntryPoint, UserOperationStruct } from "@account-abstraction/contracts";
import { Wallet, BigNumber } from "ethers";
import { SmartWallet } from "../modules/smart-wallet";
import { TransactionReceipt } from "@ethersproject/abstract-provider";
import axios from "axios";
import { BastionSignerOptions, BasicTransaction } from "../modules/bastionConnect";

let options: BastionSignerOptions;
let entryPoint: EntryPoint;
let chainId: number;
let smartWallet: SmartWallet;
const BASE_API_URL = "http://localhost:3000";
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

async function initParams(provider: JsonRpcProvider, options1?: BastionSignerOptions) {
	options = options1;
	smartWallet = new SmartWallet();
	let signer;

	const network = await provider.getNetwork();
	chainId = network.chainId;

	try {
		const address = await provider.getSigner().getAddress();
		signer = provider.getSigner();
	} catch (e) {
		signer = new Wallet(options.privateKey, provider);
	}

	entryPoint = EntryPoint__factory.connect(ENTRY_POINT_ADDRESS, signer);
}

export async function createTransactionResponse(userOp1: UserOperationStruct, apiKey: string): Promise<TransactionResponse> {
	const userOp = await resolveProperties(userOp1);
	const userOpHash = await entryPoint.getUserOpHash(userOp);
	try {
		const headers = { 'x-api-key': apiKey }
		const getTransactionHash: TransactionReceipt = await axios.post(
			`${BASE_API_URL}/v1/transaction/payment-sponsorship`,
			{
				chainId: chainId,
				userOperation: userOp,
			},
			{ headers }
		);

		let nonce = BigNumber.from(userOp.nonce);

		return {
			hash: userOpHash,
			confirmations: 0,
			from: userOp.sender,
			nonce: nonce.toNumber(),
			gasLimit: BigNumber.from(userOp.callGasLimit),
			value: BigNumber.from(0),
			data: hexValue(userOp.callData),
			chainId: chainId,
			wait: async (confirmations?: number): Promise<TransactionReceipt> => {
				const transactionReceipt = await getTransactionHash;
				return transactionReceipt;
			},
		};
	} catch (e) {
		console.log("error::createTransactionResponse", e);
	}
}

export async function batchTransactionRouting(provider: JsonRpcProvider, transactions: BasicTransaction[], options?: BastionSignerOptions): Promise<TransactionResponse> {
	try {
		await initParams(provider, options);

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

		if (!options.noSponsorship) {
			userOpToSign = options.gasToken ? await smartWallet.getPaymasterSponsorshipERC20(chainId, userOperation, options.gasToken, options.apiKey) : await smartWallet.getPaymasterSponsorship(chainId, userOperation, options.apiKey);
		}

		const signedUserOperation = await smartWallet.signUserOperation(provider, userOpToSign, options);
		const res = await smartWallet.sendTransaction(provider, signedUserOperation, options);

		console.log("Response of send transaction: ", res);
		return await createTransactionResponse(signedUserOperation, options.apiKey);
	} catch (error) {
		console.error("Error in batchTransactionRouting:", error.message);
		throw new Error(`batchTransactionRouting error: ${error.message}`);
	}
}

export async function transactionRouting(provider: JsonRpcProvider, transaction: Deferrable<TransactionRequest>, options?: BastionSignerOptions): Promise<TransactionResponse> {
	try {
		await initParams(provider, options);

		const transactionDefaults = {
			value: 0,
			data: "0x",
		};
		transaction = { ...transactionDefaults, ...transaction };

		const userOperation = await smartWallet.prepareTransaction(provider, transaction.to as string, transaction.value as number, options, transaction.data as string);

		let userOpToSign = userOperation;

		if (!options.noSponsorship) {
			userOpToSign = options.gasToken ? await smartWallet.getPaymasterSponsorshipERC20(chainId, userOperation, options.gasToken, options.apiKey) : await smartWallet.getPaymasterSponsorship(chainId, userOperation, options.apiKey);
		}

		const signedUserOperation = await smartWallet.signUserOperation(provider, userOpToSign, options);

		const res = await smartWallet.sendTransaction(provider, signedUserOperation, options);
		console.log("Response of send transaction: ", res);

		return await createTransactionResponse(signedUserOperation, options.apiKey);
	} catch (error) {
		console.error("Error in transactionRouting:", error.message);
		throw new Error(`transactionRouting error: ${error.message}`);
	}
}

