import { Deferrable } from "ethers/lib/utils";
import { Provider, Web3Provider, TransactionRequest, TransactionResponse } from "@ethersproject/providers";
import { Wallet, constants, utils, ethers, Signer } from "ethers";
import { SmartWallet } from "../smart-wallet";
import { transactionRouting } from "../../helpers/signerHelper";

export interface BastionSignerOptions {
	privateKey: string;
	rpcUrl: string;
	chainId: number;
	gasToken?: string;
}

export class BastionConnect extends Signer {
	signer: Signer;
	address: string;
	externalProvider: Web3Provider;
	options: BastionSignerOptions;
	smartWallet: SmartWallet;

	constructor() {
		super();
	}

	async init(externalProvider: Web3Provider, options?: BastionSignerOptions) {
		const config = {
			apiKey: "testApiKey",
			baseUrl: "testBaseUrl",
		};
		this.smartWallet = new SmartWallet(config);
		this.externalProvider = externalProvider;
		this.options = options;

		try {
			const address = await externalProvider.getSigner().getAddress();
			this.signer = externalProvider.getSigner();
		} catch (e) {
			this.signer = new Wallet(options.privateKey, externalProvider);
		}
	}

	async getAddress(): Promise<string> {
		// const { smartAccountAddress } = await this.smartWallet.getSmartAccountAddress(this.provider, this.options);
		// return smartAccountAddress;
		return this.signer.getAddress();
	}

	async signMessage(message: string | ethers.utils.Bytes): Promise<string> {
		return this.signer.signMessage(message);
	}

	async getSigner(): Promise<Signer> {
		return this.signer;
	}

	async getTransactionCount(blockTag?: string | number): Promise<number> {
		return this.signer.getTransactionCount(blockTag);
	}

	async sendTransaction(transaction: Deferrable<TransactionRequest>): Promise<TransactionResponse> {
		return transactionRouting(this.externalProvider, transaction, this.options);
	}

	async signTransaction(transaction: Deferrable<ethers.providers.TransactionRequest>): Promise<string> {
		throw new Error("signTransaction Method not implemented.");
	}

	connect(provider: Provider): ethers.Signer {
		throw new Error("Method not implemented.");
	}
}

