import { Deferrable } from "ethers/lib/utils";
import { Provider, Web3Provider } from "@ethersproject/providers";
import { Wallet, constants, utils, ethers } from "ethers";
import { Signer } from "@ethersproject/abstract-signer";
import { TransactionRequest } from "@ethersproject/abstract-provider";

export interface BastionSignerOptions {
	privateKey: string;
	rpcUrl: string;
	chainId: number;
}

export class BastionSigner extends Signer {
	signer: Signer;
	address: string;

	constructor() {
		super();
	}

	async init(externalProvider: Web3Provider, options?: BastionSignerOptions) {
		try {
			const address = await externalProvider.getSigner().getAddress();
			this.signer = externalProvider.getSigner();
		} catch (e) {
			this.signer = new Wallet(options.privateKey, externalProvider);
		}
	}

	async getAddress(): Promise<string> {
		console.log("Inside getAddress = ", this.signer.getAddress());
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

	async sendTransaction(transaction: any): Promise<any> {
		console.log("Inside sendTransaction = ", transaction);
		return this.signer.sendTransaction(transaction);
	}

	async signTransaction(transaction: Deferrable<ethers.providers.TransactionRequest>): Promise<string> {
		throw new Error("signTransaction Method not implemented.");
	}

	connect(provider: Provider): ethers.Signer {
		throw new Error("Method not implemented.");
	}
}

