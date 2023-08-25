import { Deferrable } from "ethers/lib/utils";
import { Provider, TransactionRequest, TransactionResponse, JsonRpcProvider } from "@ethersproject/providers";
import { ethers, Signer } from "ethers";
import { SmartWallet } from "../smart-wallet";
import { transactionRouting, batchTransactionRouting, getTransactionHash } from "../../helpers/signerHelper";
import { checkChainCompatibility } from "../../helper";
import axios from "axios";

export interface BastionSignerOptions {
	privateKey: string;
	rpcUrl: string;
	chainId: number;
	apiKey: string;
	gasToken?: string;
	noSponsorship?: boolean;
}

export interface BasicTransaction {
	to: string;
	value?: number;
	data?: string;
}

export class BastionConnect extends Signer {
	signer: Signer;
	address: string;
	externalProvider: JsonRpcProvider;
	options: BastionSignerOptions;
	smartWalletInstance: SmartWallet;
	BASE_API_URL = "https://api.bastionwallet.io";

	async init(externalProvider: JsonRpcProvider, options?: BastionSignerOptions) {
		this.smartWalletInstance = new SmartWallet();
		this.externalProvider = externalProvider;

		const chainId = options?.chainId || (await externalProvider.getNetwork()).chainId;

		if (!options.apiKey) {
			throw new Error("API Key is required");
		}

		// const headers = {
		// 	"x-api-key": options.apiKey,
		// };
		// const keyIsValid = await axios.get(`${this.BASE_API_URL}/v1/auth/validate-key/${options.apiKey}`, { headers });
		// console.log("keyIsValid", keyIsValid.data);

		this.options = options || {
			privateKey: "",
			rpcUrl: "",
			chainId: 0,
			apiKey: options.apiKey,
		};

		//Check whether the SDK supports this chain
		await checkChainCompatibility(chainId);
	}

	constructor() {
		super();
	}

	async getAddress(): Promise<string> {
		const { smartAccountAddress } = await this.smartWalletInstance.initParams(this.externalProvider, this.options);
		return smartAccountAddress;
	}

	async signMessage(message: string | ethers.utils.Bytes): Promise<string> {
		return this.signer.signMessage(message);
	}

	async getSigner(): Promise<Signer> {
		return this.signer;
	}

	async getTransactionCount(block?: string | number): Promise<number> {
		return this.signer.getTransactionCount(block);
	}

	async sendTransaction(transaction: Deferrable<TransactionRequest>): Promise<TransactionResponse> {
		return transactionRouting(this.externalProvider, transaction, this.options);
	}

	async executeBatch(transactions: BasicTransaction[]): Promise<TransactionResponse> {
		return batchTransactionRouting(this.externalProvider, transactions, this.options);
	}

	async signTransaction(transaction: Deferrable<ethers.providers.TransactionRequest>): Promise<string> {
		throw new Error("signTransaction Method not implemented.");
	}

	async getTransactionHash(userOpHash: string): Promise<string> {
		return getTransactionHash(this.externalProvider, userOpHash, this.options);
	}

	connect(provider: Provider): ethers.Signer {
		throw new Error("Method not implemented.");
	}
}

