import { Base } from "../../base";
import { SampleOptions, SampleResponse, WalletStruct } from "./types";
import { SimpleAccountFactory__factory, EntryPoint__factory, SimpleAccount__factory, EntryPoint, UserOperationStruct } from "@account-abstraction/contracts";
import { Provider, StaticJsonRpcProvider } from "@ethersproject/providers";
import { BigNumber, Wallet, constants, utils } from "ethers";
import { ERC20, ERC20__factory } from "@pimlico/erc20-paymaster/contracts";
import { getERC20Paymaster } from "@pimlico/erc20-paymaster";

const resourceName = "smartWallet";

export class SmartWallet extends Base {
	SIMPLE_ACCOUNT_FACTORY_ADDRESS = "0x9406Cc6185a346906296840746125a0E44976454";
	ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

	init(): Promise<void> {
		//execute initazation steps
		return;
	}

	sampleFunc(sampleOptions: SampleOptions): SampleResponse {
		return { retArg: "sampleResponse1" };
	}

	async getSmartAccountAddress(params: WalletStruct): Promise<string> {
		// console.log("params:", params);
		if (!params.privateKey || !params.rpcUrl) {
			throw new Error("Missing required params. You need to send a private key and an RPC URL");
		}
		const rpcProvider = new StaticJsonRpcProvider(params.rpcUrl);
		const wallet = new Wallet(params.privateKey, rpcProvider);
		const entryPoint = EntryPoint__factory.connect(this.ENTRY_POINT_ADDRESS, rpcProvider);
		const simpleAccountFactory = SimpleAccountFactory__factory.connect(this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, rpcProvider);

		// TODO - Make the 2nd argument to createAccount configurable - this is the "salt" which determines the address of the smart account
		const initCode = utils.hexConcat([this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, simpleAccountFactory.interface.encodeFunctionData("createAccount", [wallet.address, 0])]);

		// console.log("Generated initCode:", initCode);
		let senderAddress;
		try {
			await entryPoint.callStatic.getSenderAddress(initCode);
			throw new Error("Expected getSenderAddress() to revert");
		} catch (e) {
			const data = e.message.match(/0x6ca7b806([a-fA-F\d]*)/)?.[1];
			if (!data) {
				throw new Error("Failed to parse revert data");
			}
			senderAddress = utils.getAddress(`0x${data.slice(24, 64)}`);
		}

		// console.log("Calculated sender address:", senderAddress);
		return senderAddress;
	}

	async initSmartAccount(params: WalletStruct): Promise<boolean> {
		// console.log("params:", params);
		if (!params.privateKey || !params.rpcUrl) {
			throw new Error("Missing required params. You need to send a private key and an RPC URL");
		}
		const rpcProvider = new StaticJsonRpcProvider(params.rpcUrl);
		const wallet = new Wallet(params.privateKey, rpcProvider);
		const entryPoint = EntryPoint__factory.connect(this.ENTRY_POINT_ADDRESS, rpcProvider);
		const simpleAccountFactory = SimpleAccountFactory__factory.connect(this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, wallet);

		const createTx = await simpleAccountFactory.createAccount(wallet.address, 0);
		await createTx.wait();
		console.log("Created smart account", createTx.hash);

		return true;
	}
}

