import { Deferrable, hexValue, resolveProperties } from "ethers/lib/utils";
import { Provider, Web3Provider, TransactionRequest, TransactionResponse } from "@ethersproject/providers";
import { SimpleAccountFactory__factory, EntryPoint__factory, SimpleAccount__factory, EntryPoint, UserOperationStruct } from "@account-abstraction/contracts";
import { ECDSAKernelFactory__factory } from "../modules/smart-wallet/contracts";
import { Wallet, constants, utils, ethers, Signer, BigNumber } from "ethers";
import { SmartWallet } from "../modules/smart-wallet";
import { TransactionReceipt } from "@ethersproject/abstract-provider";
import axios from "axios";
import { BastionSignerOptions } from "../modules/bastionConnect";

let options: BastionSignerOptions;
let entryPoint: EntryPoint;
let smartWallet: SmartWallet;
const BASE_API_URL = "http://localhost:3000";
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

async function initParams(provider: Web3Provider, options1?: BastionSignerOptions) {
	options = options1;
	const config = {
		apiKey: "testApiKey",
		baseUrl: "testBaseUrl",
	};
	smartWallet = new SmartWallet(config);
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
}

export async function transactionRouting(provider: Web3Provider, transaction: Deferrable<TransactionRequest>, options?: BastionSignerOptions): Promise<TransactionResponse> {
	await initParams(provider, options);
	if (!transaction.value) {
		transaction.value = 0;
	}

	if (!transaction.data) {
		transaction.data = "0x";
	}
	const userOperation = await smartWallet.prepareTransaction(provider, transaction.to as string, transaction.value as number, options, transaction.data as string);
	let paymasterDataResponse;
	if (options.gasToken) {
		paymasterDataResponse = await smartWallet.getPaymasterSponsorshipERC20(options.chainId, userOperation, options.gasToken);
	} else {
		paymasterDataResponse = await smartWallet.getPaymasterSponsorship(options.chainId, userOperation);
	}
	const { paymaster, paymasterURL, userOperation: sponsoredUserOperation} = paymasterDataResponse;
	const signedUserOperation = await smartWallet.signUserOperation(provider, sponsoredUserOperation, options);
	console.log("Inside transactionRouting, signedUserOperation = ", signedUserOperation);
	try {
		let res: any = await smartWallet.sendTransaction(provider, signedUserOperation, options);
		console.log("Resonse of send transaction: ", res);
		res = { ...res, paymaster, paymasterURL };
		return await createTransactionResponse(userOperation);
	} catch (error) {
		console.log("error:transactionRouting", error.response.data );
		throw `error::transactionRouting: ${error.response.data.message}`;
	}
}

