// import { SmartWallet } from "./modules/smart-wallet";
import { BastionConnect } from "./modules/bastionConnect";

export default class Bastion {
	// smartWallet: SmartWallet;
	bastionConnect: BastionConnect;

	constructor() {
		// this.smartWallet = new SmartWallet(config);
		this.bastionConnect = new BastionConnect();
	}
}

