import { Deferrable, hexValue, resolveProperties } from "ethers/lib/utils";
import { TransactionRequest, TransactionResponse } from "@ethersproject/providers";
import { EntryPoint__factory, EntryPoint, UserOperationStruct } from "@account-abstraction/contracts";
import { BigNumber } from "ethers";
import {PublicClient, WalletClient, getContract, GetContractReturnType } from "viem";
import { TransactionReceipt } from "@ethersproject/abstract-provider";
import { BastionSignerOptions, BasicTransaction } from "../modules/bastionConnect";
import { createDummyTransactionReceipt } from "../helper";
import { SmartWalletViem } from "../modules/smart-wallet/viemSmartWallet";
import { UserOperationStructViem } from "src/modules/viemConnect/type";

const BASE_API_URL = "https://api.bastionwallet.io";
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

let options: BastionSignerOptions;
let entryPoint: GetContractReturnType;
let chainId: number;
let smartWallet: SmartWalletViem;
let initialized = false;

async function initializeIfNeeded(publicClient: PublicClient, walletClient: WalletClient, newOptions?: BastionSignerOptions) {
	if (!initialized || options !== newOptions) {
		await initParams(publicClient, walletClient, newOptions);
		initialized = true;
	}
}

async function initParams(publicClient: PublicClient, walletClient: WalletClient, newOptions?: BastionSignerOptions) {
	options = newOptions;
	smartWallet = new SmartWalletViem();
	chainId = publicClient.chain.id;
    entryPoint = getContract({
			address: this.ENTRY_POINT_ADDRESS as `0x${string}`,
			abi: EntryPoint__factory.abi,
			walletClient,
	})
	// entryPoint = EntryPoint__factory.connect(ENTRY_POINT_ADDRESS, signer);
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

export async function batchTransactionRouting(publicClient: PublicClient, walletClient: WalletClient, transactions: BasicTransaction[], options?: BastionSignerOptions): Promise<TransactionResponse> {
	try {
		await initializeIfNeeded(publicClient, walletClient, options);

		const to: `0x${string}`[] = [];
		const value: bigint[] = [];
		const data: `0x${string}`[] = [];

		for (const transaction of transactions) {
			to.push(transaction.to as `0x${string}`);
			value.push(BigInt(transaction.value)?? BigInt(0));
			data.push(transaction.data as `0x${string}` ?? "0x");
		}

		const userOperation = await smartWallet.prepareBatchTransaction(publicClient ,walletClient, to, data, value, options);
		let userOpToSign: UserOperationStructViem = userOperation as UserOperationStructViem ;

		if (!options?.noSponsorship) {
			userOpToSign = options?.gasToken
				?( await smartWallet.getPaymasterSponsorshipERC20(chainId, userOperation, options.gasToken, options.apiKey)) as UserOperationStructViem
				: (await smartWallet.getPaymasterSponsorship(chainId, userOperation, options?.apiKey || "")) as UserOperationStructViem;
		}

		const signedUserOperation: UserOperationStructViem = (await smartWallet.signUserOperation(publicClient, walletClient, userOpToSign, options)) as UserOperationStructViem;
		const res = await smartWallet.sendTransaction(signedUserOperation, options);

		await new Promise((resolve) => setTimeout(resolve, 5000));
		return await createTransactionResponse(signedUserOperation, res.userOperationHash, options?.apiKey || "");
	} catch (error) {
		console.error("Error in batchTransactionRouting:", error.message);
		throw new Error(`batchTransactionRouting error: ${error.message}`);
	}
}

export async function transactionRouting(publicClient: PublicClient, walletClient: WalletClient, transaction: Deferrable<TransactionRequest>, options?: BastionSignerOptions): Promise<TransactionResponse> {
	try {
		await initializeIfNeeded(publicClient, walletClient, options);
		const transactionDefaults = {
			value: 0,
			data: "0x",
		};
		transaction = { ...transactionDefaults, ...transaction };

		const userOperation = await smartWallet.prepareTransaction(publicClient, walletClient, transaction.to as `0x${string}`, transaction.value as number, options, transaction.data as `0x${string}`);

		let userOpToSign: UserOperationStructViem = userOperation as UserOperationStructViem;

		if (!options?.noSponsorship) {
			userOpToSign = options?.gasToken
				? (await smartWallet.getPaymasterSponsorshipERC20(chainId, userOperation, options.gasToken, options.apiKey)) as UserOperationStructViem
				: (await smartWallet.getPaymasterSponsorship(chainId, userOperation, options?.apiKey || "")) as UserOperationStructViem;
		}

		const signedUserOperation: UserOperationStructViem = (await smartWallet.signUserOperation(publicClient,walletClient, userOpToSign, options)) as UserOperationStructViem;

		const res = await smartWallet.sendTransaction(signedUserOperation, options);

		await new Promise((resolve) => setTimeout(resolve, 5000));
		return await createTransactionResponse(signedUserOperation, res.userOperationHash, options?.apiKey || "");
	} catch (error) {
		console.error("Error in transactionRouting:", error.message);
		throw new Error(`transactionRouting error: ${error.message}`);
	}
}

export async function getTransactionHash(publicClient: PublicClient, walletClient: WalletClient, userOpHash: string, options?: BastionSignerOptions): Promise<string> {
	try {
		await initializeIfNeeded(publicClient, walletClient, options);
		const chainId = options?.chainId ? options.chainId : publicClient.chain.id;
		const transactionHash = await smartWallet.getTransactionReceiptByUserOpHash(userOpHash, chainId, options?.apiKey || "");
		return transactionHash;
	} catch (error) {
		console.error("Error in getTransactionHash:", error.message);
		throw new Error(`getTransactionHash error: ${error.message}`);
	}
}

