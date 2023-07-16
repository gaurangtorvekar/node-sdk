import { Base } from "../../base";
import { SampleOptions, SampleResponse, WalletStruct } from "./types";
import { SimpleAccountFactory__factory, EntryPoint__factory, SimpleAccount__factory, EntryPoint, UserOperationStruct } from "@account-abstraction/contracts";
import { Provider, StaticJsonRpcProvider } from "@ethersproject/providers";
import { Wallet, constants, utils } from "ethers";
import { ERC20, ERC20__factory } from "@pimlico/erc20-paymaster/contracts";
import { getERC20Paymaster } from "@pimlico/erc20-paymaster";
import { BaseContract, BigNumber, BigNumberish, BytesLike, CallOverrides, ContractTransaction, Overrides, PayableOverrides, PopulatedTransaction, Signer } from "ethers";
import { getChainName } from "../../helper";
const dotenv = require("dotenv");

dotenv.config();

const resourceName = "smartWallet";

export class SmartWallet extends Base {
	SIMPLE_ACCOUNT_FACTORY_ADDRESS = "0x9406Cc6185a346906296840746125a0E44976454";
	ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

	init(): Promise<void> {
		//execute initazation steps
		return;
	}

	private async initParams(params: WalletStruct) {
		if (!params.privateKey || !params.rpcUrl) {
			throw new Error("Missing required params. You need to send a private key and an RPC URL");
		}
		const rpcProvider = new StaticJsonRpcProvider(params.rpcUrl);
		const wallet = new Wallet(params.privateKey, rpcProvider);
		const entryPoint = EntryPoint__factory.connect(this.ENTRY_POINT_ADDRESS, rpcProvider);
		const simpleAccountFactory = SimpleAccountFactory__factory.connect(this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, wallet);

		return { rpcProvider, wallet, entryPoint, simpleAccountFactory };
	}

	async getSmartAccountAddress(params: WalletStruct): Promise<string> {
		const { wallet, entryPoint, simpleAccountFactory } = await this.initParams(params);

		// TODO - Make the 2nd argument to createAccount configurable - this is the "salt" which determines the address of the smart account
		const initCode = utils.hexConcat([this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, simpleAccountFactory.interface.encodeFunctionData("createAccount", [wallet.address, 0])]);

		// console.log("Generated initCode:", initCode);
		let smartAccountAddress;
		try {
			await entryPoint.callStatic.getSenderAddress(initCode);
			throw new Error("Expected getSenderAddress() to revert");
		} catch (e) {
			const data = e.message.match(/0x6ca7b806([a-fA-F\d]*)/)?.[1];
			if (!data) {
				throw new Error("Failed to parse revert data");
			}
			smartAccountAddress = utils.getAddress(`0x${data.slice(24, 64)}`);
		}

		// console.log("Calculated sender address:", senderAddress);
		return smartAccountAddress;
	}

	//Feature - Enable creating this Smart Account on multiple chains
	async initSmartAccount(params: WalletStruct): Promise<boolean> {
		const { wallet, entryPoint, simpleAccountFactory } = await this.initParams(params);

		const createTx = await simpleAccountFactory.createAccount(wallet.address, 0);
		await createTx.wait();
		console.log("Created smart account", createTx.hash);

		return true;
	}

	// Note - this function makes the Smart Account contract pay for the gas. We are NOT using the Pimlico paymaster, we are just using their bundler
	// Need to fund the Smart Contract or the bundler will throw an error
	async sendNativeCurrency(params: WalletStruct, to: string, value: number, data?: string): Promise<boolean> {
		const { rpcProvider, wallet, entryPoint } = await this.initParams(params);

		const smartAccountAddress = await this.getSmartAccountAddress(params);
		console.log("sendNativeCurrency| Smart wallet address: ", smartAccountAddress);

		const simpleAccount = SimpleAccount__factory.connect(smartAccountAddress, rpcProvider);

		const callData = simpleAccount.interface.encodeFunctionData("execute", [to, value, data]);
		console.log("sendNativeCurrency| Call data: ", callData);

		const simpleAccountFactory = SimpleAccountFactory__factory.connect(this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, rpcProvider);
		const initCode = utils.hexConcat([this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, simpleAccountFactory.interface.encodeFunctionData("createAccount", [wallet.address, 0])]);

		console.log("sendNativeCurrency| Init code: ", initCode);

		const gasPrice = await rpcProvider.getGasPrice();
		const nonce = await simpleAccount.callStatic.getNonce();
		console.log("sendNativeCurrency| Nonce: ", nonce);

		//Check if the smart account contract has been deployed
		const contractCode = await rpcProvider.getCode(smartAccountAddress);

		const userOperation = {
			sender: smartAccountAddress,
			nonce: utils.hexlify(nonce),
			initCode: contractCode === "0x" ? initCode : "0x",
			callData,
			callGasLimit: utils.hexlify(100_000),
			verificationGasLimit: utils.hexlify(400_000),
			preVerificationGas: utils.hexlify(50000),
			maxFeePerGas: utils.hexlify(gasPrice),
			maxPriorityFeePerGas: utils.hexlify(gasPrice),
			paymasterAndData: "0x",
			signature: "0x",
		};
		const signature = await wallet.signMessage(utils.arrayify(await entryPoint.getUserOpHash(userOperation)));
		userOperation.signature = signature;

		console.log("sendNativeCurrency| User operation: ", userOperation);

		const chain = await getChainName(params.chainId); // find the list of chain names on the Pimlico verifying paymaster reference page
		const apiKey = process.env.PIMLICO_API_KEY;

		const pimlicoEndpoint = `https://api.pimlico.io/v1/${chain}/rpc?apikey=${apiKey}`;

		const pimlicoProvider = new StaticJsonRpcProvider(pimlicoEndpoint);

		//First find the native currency balance for the smartAccount
		const eth_balance = await rpcProvider.getBalance(smartAccountAddress);
		console.log("sendNativeCurrency| Smart account balance: ", eth_balance);

		if (eth_balance < BigNumber.from(10)) {
			throw new Error("Insufficient balance in smart account");
		}

		const userOperationHash = await pimlicoProvider.send("eth_sendUserOperation", [userOperation, this.ENTRY_POINT_ADDRESS]);
		console.log("User operation hash: ", userOperationHash);

		console.log("Querying for receipts...");
		let receipt = null;
		while (!receipt) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			receipt = await pimlicoProvider.send("eth_getUserOperationReceipt", [userOperationHash]);
		}

		const txHash = receipt.receipt.transactionHash;
		console.log("Transaction hash: ", txHash);
		return true;
	}
}

