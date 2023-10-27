import { BastionConnect } from "./modules/bastionConnect";

export class Bastion {
	bastionConnect: BastionConnect;

	constructor() {
		this.bastionConnect = new BastionConnect();
	}
}

