import { Deferrable, hexValue, resolveProperties } from "ethers/lib/utils";
import { Provider, JsonRpcProvider, TransactionRequest, TransactionResponse } from "@ethersproject/providers";
import { SimpleAccountFactory__factory, EntryPoint__factory, SimpleAccount__factory, EntryPoint, UserOperationStruct } from "@account-abstraction/contracts";
import { ECDSAKernelFactory__factory } from "../modules/smart-wallet/contracts";
import { Wallet, constants, utils, ethers, Signer, BigNumber } from "ethers";
import { SmartWallet } from "../modules/smart-wallet";
import { TransactionReceipt } from "@ethersproject/abstract-provider";
import axios from "axios";
import { BastionSignerOptions, BasicTransaction } from "../modules/bastionConnect";

let options: BastionSignerOptions;
let entryPoint: EntryPoint;
let smartWallet: SmartWallet;
const BASE_API_URL = "http://localhost:3000";
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

async function initParams(provider: JsonRpcProvider, options1?: BastionSignerOptions) {
	options = options1;
	smartWallet = new SmartWallet();
	let signer, wallet;

	try {
		const address = await provider.getSigner().getAddress();
		signer = provider.getSigner();
	} catch (e) {
		signer = new Wallet(options.privateKey, provider);
	}

	entryPoint = EntryPoint__factory.connect(ENTRY_POINT_ADDRESS, signer);
}

export async function createTransactionResponse(userOp1: UserOperationStruct): Promise<TransactionResponse> {
	const userOp = await resolveProperties(userOp1);
	const userOpHash = await entryPoint.getUserOpHash(userOp);
	try {
		const getTransactionHash: TransactionReceipt = await axios.post(`${BASE_API_URL}/v1/transaction/payment-sponsorship`, {
			chainId: options.chainId,
			userOperation: userOp,
		});

		let nonce = BigNumber.from(userOp.nonce);

		return {
			hash: userOpHash,
			confirmations: 0,
			from: userOp.sender,
			nonce: nonce.toNumber(),
			gasLimit: BigNumber.from(userOp.callGasLimit),
			value: BigNumber.from(0),
			data: hexValue(userOp.callData),
			chainId: options.chainId,
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

		// Create arrays of to[], value[], data[] from transactions[]
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
			userOpToSign = options.gasToken
				? await smartWallet.getPaymasterSponsorshipERC20(options.chainId, userOperation, options.gasToken)
				: await smartWallet.getPaymasterSponsorship(options.chainId, userOperation);
		}

		const signedUserOperation = await smartWallet.signUserOperation(provider, userOpToSign, options);
		const res = await smartWallet.sendTransaction(provider, signedUserOperation, options);

		console.log("Response of send transaction: ", res);
		return await createTransactionResponse(signedUserOperation);
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
			userOpToSign = options.gasToken
				? await smartWallet.getPaymasterSponsorshipERC20(options.chainId, userOperation, options.gasToken)
				: await smartWallet.getPaymasterSponsorship(options.chainId, userOperation);
		}

		const signedUserOperation = await smartWallet.signUserOperation(provider, userOpToSign, options);

		const res = await smartWallet.sendTransaction(provider, signedUserOperation, options);
		console.log("Response of send transaction: ", res);

		return await createTransactionResponse(signedUserOperation);
	} catch (error) {
		console.error("Error in transactionRouting:", error.message);
		throw new Error(`transactionRouting error: ${error.message}`);
	}
}

