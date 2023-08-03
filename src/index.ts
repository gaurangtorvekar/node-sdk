import { SmartWallet } from "./modules/smart-wallet";
import { BastionSigner } from "./modules/bastion-signer";

export class Bastion {
	smartWallet: SmartWallet;
	bastionSigner: BastionSigner;

	constructor(config: { apiKey: string; baseUrl?: string }) {
		this.smartWallet = new SmartWallet(config);
		this.bastionSigner = new BastionSigner();
	}
}

