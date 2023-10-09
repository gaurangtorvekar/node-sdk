import { BastionConnect } from "./modules/bastionConnect";
import { ViemConnect } from "./modules/viemConnect";

export class Bastion {
	bastionConnect: BastionConnect;
	viemConnect : ViemConnect

	constructor() {
		this.bastionConnect = new BastionConnect();
		this.viemConnect = new ViemConnect();
	}
}

