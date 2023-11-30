import { Deferrable } from "ethers/lib/utils";
import { Provider, TransactionRequest, TransactionResponse, JsonRpcProvider } from "@ethersproject/providers";
import { ethers, Signer } from "ethers";
import { SmartWallet } from "../smart-wallet";
import { transactionRouting, batchTransactionRouting, getTransactionHash } from "../../helpers/signerHelper";
import { checkChainCompatibility } from "../../helper";
import axios from "axios";

export interface BastionSignerOptions {
	privateKey?: string;
	rpcUrl?: string;
	chainId?: number;
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
	private BASE_API_URL = "https://api.bastionwallet.io";

	private signer: Signer;
	private address: string;
	private externalProvider: JsonRpcProvider;
	private smartWalletInstance: SmartWallet;
	private options: BastionSignerOptions;

	constructor() {
		super();
	}

	private async validateApiKey(apiKey?: string): Promise<void> {
		if (!apiKey) {
			throw new Error("API Key is required");
		}

		const response = await fetch(`${this.BASE_API_URL}/v1/auth/validate-key/${apiKey}`);
		const res = await response.json();
		if (!res.data.isValid) {
			throw new Error("Invalid API Key");
		}
	}

	async init(externalProvider: JsonRpcProvider, options?: BastionSignerOptions) {
		await this.validateApiKey(options?.apiKey);

		const chainId = options?.chainId || (await externalProvider.getNetwork()).chainId;
		await checkChainCompatibility(chainId);

		this.smartWalletInstance = new SmartWallet();
		this.externalProvider = externalProvider;
		this.options = { ...options, chainId };

		const { signer, smartAccountAddress, exists } = await this.smartWalletInstance.initParams(this.externalProvider, this.options);
		this.signer = signer;

		return {smartAccountAddress, exists};
	}

	async getAddress(): Promise<string> {
		const { smartAccountAddress, exists } = await this.smartWalletInstance.initParams(this.externalProvider, this.options);
		return smartAccountAddress;
	}

	async getSmartAccountAddress(): Promise<{smartAccountAddress:string, exists: boolean}> {
		const { smartAccountAddress, exists } = await this.smartWalletInstance.initParams(this.externalProvider, this.options);
		return  { smartAccountAddress, exists };
	}

	async getSigner(): Promise<Signer> {
		return this.signer;
	}

	async getTransactionCount(block?: string | number): Promise<number> {
		return this.signer.getTransactionCount(block);
	}

	async signMessage(message: string | ethers.utils.Bytes): Promise<string> {
		return this.signer.signMessage(message);
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

	async createSmartAccount(): Promise<string> {
		return this.smartWalletInstance.createSmartAccount(this.externalProvider, this.options);
	}

	async createSmartAccountByDapp(): Promise<string> {
		return this.smartWalletInstance.createSmartAccountDapp(this.externalProvider, this.options);
	}

	connect(provider: Provider): ethers.Signer {
		throw new Error("Method not implemented.");
	}
}

