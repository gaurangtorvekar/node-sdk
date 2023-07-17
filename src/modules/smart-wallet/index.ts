import { Base } from "../../base";
import { SampleOptions, SampleResponse, WalletStruct } from "./types";
import { SimpleAccountFactory__factory, EntryPoint__factory, SimpleAccount__factory, EntryPoint, UserOperationStruct } from "@account-abstraction/contracts";
import { Provider, StaticJsonRpcProvider } from "@ethersproject/providers";
import { Wallet, constants, utils, ethers } from "ethers";
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

	private async prepareTransaction(params: WalletStruct, to: string, value: number, data?: string): Promise<UserOperationStruct> {
		const { rpcProvider, wallet, entryPoint } = await this.initParams(params);

		const smartAccountAddress = await this.getSmartAccountAddress(params);
		console.log("| Smart wallet address: ", smartAccountAddress);

		const simpleAccount = SimpleAccount__factory.connect(smartAccountAddress, rpcProvider);

		const callData = simpleAccount.interface.encodeFunctionData("execute", [to, value, data]);
		console.log("| Call data: ", callData);

		const simpleAccountFactory = SimpleAccountFactory__factory.connect(this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, rpcProvider);
		const initCode = utils.hexConcat([this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, simpleAccountFactory.interface.encodeFunctionData("createAccount", [wallet.address, 0])]);

		console.log("| Init code: ", initCode);

		const gasPrice = await rpcProvider.getGasPrice();
		const nonce = await simpleAccount.callStatic.getNonce();
		console.log("| Nonce: ", nonce);

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

		return userOperation;
	}

	private async signUserOperation(params: WalletStruct, userOperation: UserOperationStruct): Promise<UserOperationStruct> {
		const { wallet, entryPoint } = await this.initParams(params);

		const signature = await wallet.signMessage(utils.arrayify(await entryPoint.getUserOpHash(userOperation)));
		userOperation.signature = signature;

		console.log("Signed user Operation: ", userOperation);

		return userOperation;
	}

	private async getPaymasterSponsorship(chainId: number, userOperation: UserOperationStruct): Promise<UserOperationStruct> {
		const chain = await getChainName(chainId); // find the list of chain names on the Pimlico verifying paymaster reference page
		console.log("getPaymasterSponsorship | chain: ", chain);
		const apiKey = process.env.PIMLICO_API_KEY;

		const pimlicoEndpoint = `https://api.pimlico.io/v1/${chain}/rpc?apikey=${apiKey}`;
		const pimlicoProvider = new StaticJsonRpcProvider(pimlicoEndpoint);

		const sponsorUserOperationResult = await pimlicoProvider.send("pm_sponsorUserOperation", [
			userOperation,
			{
				entryPoint: this.ENTRY_POINT_ADDRESS,
			},
		]);

		const paymasterAndData = sponsorUserOperationResult.paymasterAndData;

		userOperation.paymasterAndData = paymasterAndData;
		return userOperation;
	}

	private async sendTransaction(params: WalletStruct, userOperation: UserOperationStruct): Promise<boolean> {
		const { rpcProvider } = await this.initParams(params);

		const chain = await getChainName(params.chainId); // find the list of chain names on the Pimlico verifying paymaster reference page
		const apiKey = process.env.PIMLICO_API_KEY;

		//TODO - cannot do this. We need to store the Pimlico API key on our BE.
		const pimlicoEndpoint = `https://api.pimlico.io/v1/${chain}/rpc?apikey=${apiKey}`;

		const pimlicoProvider = new StaticJsonRpcProvider(pimlicoEndpoint);

		//First find the native currency balance for the smartAccount
		const smartAccountAddress = await this.getSmartAccountAddress(params);
		const eth_balance = await rpcProvider.getBalance(smartAccountAddress);
		console.log("| Smart account balance: ", eth_balance);

		if (eth_balance < BigNumber.from(10)) {
			throw new Error("Insufficient balance in smart account");
		}

		// Cannot send this TXN from the SDK, has to be done through the BE
		const userOperationHash = await pimlicoProvider.send("eth_sendUserOperation", [userOperation, this.ENTRY_POINT_ADDRESS]);
		console.log("User operation hash: ", userOperationHash);

		try {
			console.log("Querying for receipts...");
			let receipt = null;
			while (!receipt) {
				await new Promise((resolve) => setTimeout(resolve, 3000));
				receipt = await pimlicoProvider.send("eth_getUserOperationReceipt", [userOperationHash]);
			}

			const txHash = receipt.receipt.transactionHash;
			console.log("Transaction hash: ", txHash);
			return true;
		} catch (e) {
			console.log("Error from Pimlico eth_getUserOperationReceipt: ", e);
			return true;
		}
	}

	async sendNativeCurrency(params: WalletStruct, to: string, value: number, data?: string): Promise<boolean> {
		console.log("sendNativeCurrency =====================");

		const userOperation = await this.prepareTransaction(params, to, value, data);
		const signedUserOperation = await this.signUserOperation(params, userOperation);
		return this.sendTransaction(params, signedUserOperation);
	}

	async sendNativeCurrencyGassless(params: WalletStruct, to: string, value: number, data?: string): Promise<boolean> {
		console.log("sendNativeCurrencyGassless =====================");

		const userOperation = await this.prepareTransaction(params, to, value, data);
		const sponsoredUserOperation = await this.getPaymasterSponsorship(params.chainId, userOperation);
		const signedUserOperation = await this.signUserOperation(params, sponsoredUserOperation);
		return this.sendTransaction(params, signedUserOperation);
	}

	async sendERC20Tokens(params: WalletStruct, to: string, numberTokensinWei: number, tokenAddress: string): Promise<boolean> {
		console.log("sendERC20Tokens =====================");

		const { rpcProvider } = await this.initParams(params);
		const erc20Token = ERC20__factory.connect(tokenAddress, rpcProvider);
		const data = erc20Token.interface.encodeFunctionData("transfer", [to, numberTokensinWei]);

		console.log("Calling user operation func now");
		const userOperation = await this.prepareTransaction(params, tokenAddress, 0, data);
		const signedUserOperation = await this.signUserOperation(params, userOperation);
		return this.sendTransaction(params, signedUserOperation);
	}

	async sendERC20TokensGasless(params: WalletStruct, to: string, numberTokensinWei: number, tokenAddress: string): Promise<boolean> {
		console.log("sendERC20TokensGasless =====================");

		const { rpcProvider } = await this.initParams(params);
		const erc20Token = ERC20__factory.connect(tokenAddress, rpcProvider);
		const data = erc20Token.interface.encodeFunctionData("transfer", [to, numberTokensinWei]);

		const userOperation = await this.prepareTransaction(params, tokenAddress, 0, data);
		const sponsoredUserOperation = await this.getPaymasterSponsorship(params.chainId, userOperation);
		const signedUserOperation = await this.signUserOperation(params, sponsoredUserOperation);
		return this.sendTransaction(params, signedUserOperation);
	}

	async getNativeCurrencyBalance(params: WalletStruct): Promise<number> {
		const { rpcProvider } = await this.initParams(params);
		const smartAccountAddress = await this.getSmartAccountAddress(params);
		const balance = await rpcProvider.getBalance(smartAccountAddress);
		const formatted_balance = Math.floor(parseFloat(utils.formatEther(balance)) * 100) / 100;
		console.log("Native currency balance: ", formatted_balance);

		return formatted_balance;
	}

	async getERC20TokenBalance(params: WalletStruct, tokenAddress: string): Promise<number> {
		const { rpcProvider } = await this.initParams(params);
		const erc20Token = ERC20__factory.connect(tokenAddress, rpcProvider);
		const smartAccountAddress = await this.getSmartAccountAddress(params);
		const balance = await erc20Token.balanceOf(smartAccountAddress);
		const formatted_balance = Math.floor(parseFloat(utils.formatEther(balance)) * 100) / 100;
		console.log("ERC20 token balance: ", formatted_balance);

		return formatted_balance;
	}

	async isSmartAccountDeployed(params: WalletStruct): Promise<boolean> {
		const { rpcProvider } = await this.initParams(params);
		const smartAccountAddress = await this.getSmartAccountAddress(params);
		const contractCode = await rpcProvider.getCode(smartAccountAddress);
		console.log("Smart account code: ", contractCode);

		return contractCode !== "0x";
	}
}

