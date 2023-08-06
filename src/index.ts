import { SmartWallet } from "./modules/smart-wallet";
import { BastionConnect } from "./modules/bastionConnect";

export class Bastion {
	smartWallet: SmartWallet;
	bastionConnect: BastionConnect;

	constructor(config: { apiKey: string; baseUrl?: string }) {
		this.smartWallet = new SmartWallet(config);
		this.bastionConnect = new BastionConnect();
	}
}

