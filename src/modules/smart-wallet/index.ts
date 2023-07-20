import { Base } from "../../base";
import { SampleOptions, SampleResponse, WalletStruct } from "./types";
import { SimpleAccountFactory__factory, EntryPoint__factory, SimpleAccount__factory, EntryPoint, UserOperationStruct } from "@account-abstraction/contracts";
import { Provider, StaticJsonRpcProvider, Web3Provider } from "@ethersproject/providers";
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

	private async initParams(externalProvider: Web3Provider, options?: WalletStruct) {
		// if (!params.privateKey || !params.rpcUrl) {
		// 	throw new Error("Missing required params. You need to send a private key and an RPC URL");
		// }
		// const rpcProvider = new StaticJsonRpcProvider(params.rpcUrl);
		let signer, wallet;
		try {
			const address = await externalProvider.getSigner().getAddress();
			signer = externalProvider.getSigner();
		} catch (e) {
			console.log("Couldn't call getAddress() inside initparams========");
			wallet = new ethers.Wallet(options.privateKey);
			signer = wallet.connect(externalProvider);
		}

		const entryPoint = EntryPoint__factory.connect(this.ENTRY_POINT_ADDRESS, externalProvider);
		const simpleAccountFactory = SimpleAccountFactory__factory.connect(this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, signer);

		return { signer, entryPoint, simpleAccountFactory };
	}

	async getSmartAccountAddress(externalProvider: Web3Provider, options?: WalletStruct): Promise<string> {
		// console.log("Inside getSmartAccountAddress, received provider  = ", externalProvider);
		const { signer, entryPoint, simpleAccountFactory } = await this.initParams(externalProvider, options);
		// console.log("Back inside getSmartAccountAddress, entryPoint = ", entryPoint);
		// TODO - Make the 2nd argument to createAccount configurable - this is the "salt" which determines the address of the smart account
		const initCode = utils.hexConcat([this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, simpleAccountFactory.interface.encodeFunctionData("createAccount", [await signer.getAddress(), 0])]);
		console.log("Inside getSmartAccountAddress, Generated initCode:", initCode);
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

		console.log("Inside getSmartAccountAddress, Calculated sender address:", smartAccountAddress);
		return smartAccountAddress;
	}

	//TODO - Update the functions below to use the new provider instead of the params object

	//Feature - Enable creating this Smart Account on multiple chains
	async initSmartAccount(externalProvider: Web3Provider, options?: WalletStruct): Promise<boolean> {
		const { signer, entryPoint, simpleAccountFactory } = await this.initParams(externalProvider, options);

		const createTx = await simpleAccountFactory.createAccount(await signer.getAddress(), 0);
		await createTx.wait();
		console.log("Created smart account", createTx.hash);

		return true;
	}

	private async prepareTransaction(externalProvider: Web3Provider, to: string, value: number, options?: WalletStruct, data?: string): Promise<UserOperationStruct> {
		const { signer, entryPoint } = await this.initParams(externalProvider, options);
		console.log("Inside prepareTransaction, Got back signer = ", await signer.getAddress());
		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
		console.log("| Smart wallet address: ", smartAccountAddress);

		const simpleAccount = SimpleAccount__factory.connect(smartAccountAddress, externalProvider);

		const callData = simpleAccount.interface.encodeFunctionData("execute", [to, value, data]);
		console.log("| Call data: ", callData);

		const simpleAccountFactory = SimpleAccountFactory__factory.connect(this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, externalProvider);
		const initCode = utils.hexConcat([this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, simpleAccountFactory.interface.encodeFunctionData("createAccount", [await signer.getAddress(), 0])]);

		console.log("| Init code: ", initCode);

		const gasPrice = await externalProvider.getGasPrice();

		//Check if the smart account contract has been deployed
		const contractCode = await externalProvider.getCode(smartAccountAddress);
		let nonce;
		if (contractCode === "0x") {
			nonce = 0;
		} else {
			nonce = await simpleAccount.callStatic.getNonce();
			console.log("| Nonce: ", nonce);
		}

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

	private async signUserOperation(externalProvider: Web3Provider, userOperation: UserOperationStruct, options?: WalletStruct): Promise<UserOperationStruct> {
		const { signer, entryPoint } = await this.initParams(externalProvider, options);

		const signature = await signer.signMessage(utils.arrayify(await entryPoint.getUserOpHash(userOperation)));
		userOperation.signature = signature;

		console.log("Signed user Operation: ", userOperation);

		return userOperation;
	}

	private async getPaymasterSponsorship(chainId: number, userOperation: UserOperationStruct, pimlicoApiKey: string): Promise<UserOperationStruct> {
		const chain = await getChainName(chainId); // find the list of chain names on the Pimlico verifying paymaster reference page
		console.log("getPaymasterSponsorship | chain: ", chain);
		const pimlicoEndpoint = `https://api.pimlico.io/v1/${chain}/rpc?apikey=${pimlicoApiKey}`;
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

	private async sendTransaction(externalProvider: Web3Provider, userOperation: UserOperationStruct, options?: WalletStruct, pimlicoApiKey?: string): Promise<boolean> {
		const chain = await getChainName(options.chainId); // find the list of chain names on the Pimlico verifying paymaster reference page

		//TODO - cannot do this. We need to store the Pimlico API key on our BE.
		const pimlicoEndpoint = `https://api.pimlico.io/v1/${chain}/rpc?apikey=${pimlicoApiKey}`;

		const pimlicoProvider = new StaticJsonRpcProvider(pimlicoEndpoint);

		//First find the native currency balance for the smartAccount
		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
		const eth_balance = await externalProvider.getBalance(smartAccountAddress);
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

	async sendNativeCurrency(externalProvider: Web3Provider, to: string, value: number, options?: WalletStruct, data?: string, pimlicoApiKey?: string): Promise<boolean> {
		console.log("sendNativeCurrency =====================");

		const userOperation = await this.prepareTransaction(externalProvider, to, value, options, data);
		console.log("Back in sendNativeCurrency, userOperation = ", userOperation);
		const signedUserOperation = await this.signUserOperation(externalProvider, userOperation, options);
		console.log("Back in sendNativeCurrency, signedUserOperation = ", userOperation);
		return this.sendTransaction(externalProvider, signedUserOperation, options, pimlicoApiKey);
	}

	async sendNativeCurrencyGasless(externalProvider: Web3Provider, to: string, value: number, options?: WalletStruct, data?: string, pimlicoApiKey?: string): Promise<boolean> {
		console.log("sendNativeCurrencyGassless =====================");

		const userOperation = await this.prepareTransaction(externalProvider, to, value, options, data);
		console.log("Back in sendNativeCurrencyGasless, userOperation = ", userOperation);
		const sponsoredUserOperation = await this.getPaymasterSponsorship(options.chainId, userOperation, pimlicoApiKey);
		console.log("Back in sendNativeCurrencyGasless, sponsoredUserOperation = ", sponsoredUserOperation);
		const signedUserOperation = await this.signUserOperation(externalProvider, sponsoredUserOperation, options);
		console.log("Back in sendNativeCurrencyGasless, signedUserOperation = ", signedUserOperation);
		return this.sendTransaction(externalProvider, signedUserOperation, options, pimlicoApiKey);
	}

	async sendTokens(externalProvider: Web3Provider, to: string, numberTokensinWei: number, tokenAddress: string, options?: WalletStruct, pimlicoApiKey?: string): Promise<boolean> {
		console.log("sendERC20Tokens =====================");

		const erc20Token = ERC20__factory.connect(tokenAddress, externalProvider);
		const data = erc20Token.interface.encodeFunctionData("transfer", [to, numberTokensinWei]);

		const userOperation = await this.prepareTransaction(externalProvider, tokenAddress, 0, options, data);
		console.log("Back in sendTokens, userOperation = ", userOperation);
		const signedUserOperation = await this.signUserOperation(externalProvider, userOperation, options);
		console.log("Back in sendTokens, signedUserOperation = ", signedUserOperation);
		return this.sendTransaction(externalProvider, signedUserOperation, options, pimlicoApiKey);
	}

	async sendTokensGasless(externalProvider: Web3Provider, to: string, numberTokensinWei: number, tokenAddress: string, options?: WalletStruct, pimlicoApiKey?: string): Promise<boolean> {
		console.log("sendERC20TokensGasless =====================");

		const erc20Token = ERC20__factory.connect(tokenAddress, externalProvider);
		const data = erc20Token.interface.encodeFunctionData("transfer", [to, numberTokensinWei]);

		const userOperation = await this.prepareTransaction(externalProvider, tokenAddress, 0, options, data);
		console.log("Back in sendTokensGasless, userOperation = ", userOperation);
		const sponsoredUserOperation = await this.getPaymasterSponsorship(options.chainId, userOperation, pimlicoApiKey);
		console.log("Back in sendTokensGasless, sponsoredUserOperation = ", sponsoredUserOperation);
		const signedUserOperation = await this.signUserOperation(externalProvider, sponsoredUserOperation, options);
		console.log("Back in sendTokensGasless, signedUserOperation = ", signedUserOperation);

		return this.sendTransaction(externalProvider, signedUserOperation, options, pimlicoApiKey);
	}

	async getNativeCurrencyBalance(externalProvider, options?: WalletStruct): Promise<number> {
		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
		console.log("Inside getNativeCurrencyBalance | Smart Account: ", smartAccountAddress);
		const balance = await externalProvider.getBalance(smartAccountAddress);
		const formatted_balance = Math.floor(parseFloat(utils.formatEther(balance)) * 100000) / 100000;
		console.log("Inside getNativeCurrencyBalance | Native currency balance: ", formatted_balance);

		return formatted_balance;
	}

	async getERC20TokenBalance(externalProvider: Web3Provider, tokenAddress: string, options?: WalletStruct): Promise<number> {
		const erc20Token = ERC20__factory.connect(tokenAddress, externalProvider);
		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
		console.log("Inside getERC20TokenBalance | Smart Account: ", smartAccountAddress);
		const balance = await erc20Token.balanceOf(smartAccountAddress);
		const formatted_balance = Math.floor(parseFloat(utils.formatEther(balance)) * 100) / 100;
		console.log("Inside getERC20TokenBalance | ERC20 token balance: ", formatted_balance);

		return formatted_balance;
	}

	async getERC20TokenBalanceBatch(externalProvider: Web3Provider, tokenAddresses: string[], options?: WalletStruct): Promise<number[]> {
		if (tokenAddresses.length > 100) {
			throw new Error("Can return maximum 100 balances at a time");
		}

		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
		console.log("Inside getERC20TokenBalanceBatch | Smart Account: ", smartAccountAddress);
		const erc20Tokens = tokenAddresses.map((tokenAddress) => ERC20__factory.connect(tokenAddress, externalProvider));
		const balancePromises = erc20Tokens.map((erc20Token) => erc20Token.balanceOf(smartAccountAddress));
		const balances = await Promise.all(balancePromises);
		const formatted_balances = balances.map((balance) => Math.floor(parseFloat(utils.formatEther(balance)) * 100) / 100);
		console.log("Inside getERC20TokenBalanceBatch | ERC20 token balances: ", formatted_balances);

		return formatted_balances;
	}

	async isSmartAccountDeployed(externalProvider: Web3Provider, options?: WalletStruct): Promise<boolean> {
		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
		console.log("Inside isSmartAccountDeployed | Smart Account: ", smartAccountAddress);
		const contractCode = await externalProvider.getCode(smartAccountAddress);
		console.log("Inside isSmartAccountDeployed | Smart account code: ", contractCode);

		return contractCode !== "0x";
	}
}

