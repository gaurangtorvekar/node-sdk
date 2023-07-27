import { Base } from "../../base";
import { SampleOptions, SampleResponse, WalletStruct } from "./types";
import { SimpleAccountFactory__factory, EntryPoint__factory, SimpleAccount__factory, EntryPoint, UserOperationStruct } from "@account-abstraction/contracts";
import { Provider, StaticJsonRpcProvider, Web3Provider } from "@ethersproject/providers";
import { Wallet, constants, utils, ethers } from "ethers";
import { ERC20, ERC20__factory } from "@pimlico/erc20-paymaster/contracts";
import { getERC20Paymaster } from "@pimlico/erc20-paymaster";
import { BaseContract, BigNumber, BigNumberish, BytesLike, CallOverrides, ContractTransaction, Overrides, PayableOverrides, PopulatedTransaction, Signer } from "ethers";
import { getChainName } from "../../helper";
import axios from "axios";
const dotenv = require("dotenv");

dotenv.config();

const resourceName = "smartWallet";

export class SmartWallet extends Base {
	SIMPLE_ACCOUNT_FACTORY_ADDRESS = "0x9406Cc6185a346906296840746125a0E44976454";
	ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
	//TO DO: CHANGE BEFORE DEPLOYMENT
	BASE_API_URL = "http://localhost:3000";

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
			signer = new Wallet(options.privateKey, externalProvider);
			// wallet = new ethers.Wallet(options.privateKey);
			// signer = wallet.connect(externalProvider);
		}

		const entryPoint = EntryPoint__factory.connect(this.ENTRY_POINT_ADDRESS, signer);
		const simpleAccountFactory = SimpleAccountFactory__factory.connect(this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, signer);

		return { signer, entryPoint, simpleAccountFactory };
	}

	async getSmartAccountAddress(externalProvider: Web3Provider, options?: WalletStruct): Promise<string> {
		const { signer, entryPoint, simpleAccountFactory } = await this.initParams(externalProvider, options);
		// TODO - Make the 2nd argument to createAccount configurable - this is the "salt" which determines the address of the smart account
		const initCode = utils.hexConcat([this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, simpleAccountFactory.interface.encodeFunctionData("createAccount", [await signer.getAddress(), 0])]);
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
		const { signer, entryPoint, simpleAccountFactory } = await this.initParams(externalProvider, options);
		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
		const simpleAccount = SimpleAccount__factory.connect(smartAccountAddress, externalProvider);

		const callData = simpleAccount.interface.encodeFunctionData("execute", [to, value, data]);
		const initCode = utils.hexConcat([this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, simpleAccountFactory.interface.encodeFunctionData("createAccount", [await signer.getAddress(), 0])]);
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
			callGasLimit: utils.hexlify(80_000),
			verificationGasLimit: utils.hexlify(300_000),
			preVerificationGas: utils.hexlify(40000),
			maxFeePerGas: utils.hexlify(gasPrice),
			maxPriorityFeePerGas: utils.hexlify(gasPrice),
			paymasterAndData: "0x",
			signature: "0x",
		};
		console.log("Inside prepareTransaction | Prepared user operation: ", userOperation);
		return userOperation;
	}

	private async prepareBatchTransaction(externalProvider: Web3Provider, to: string[], data: string[], options?: WalletStruct): Promise<UserOperationStruct> {
		const { signer, entryPoint, simpleAccountFactory } = await this.initParams(externalProvider, options);
		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
		const simpleAccount = SimpleAccount__factory.connect(smartAccountAddress, externalProvider);

		const callData = simpleAccount.interface.encodeFunctionData("executeBatch", [to, data]);
		const initCode = utils.hexConcat([this.SIMPLE_ACCOUNT_FACTORY_ADDRESS, simpleAccountFactory.interface.encodeFunctionData("createAccount", [await signer.getAddress(), 0])]);
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
			callGasLimit: utils.hexlify(80_000),
			verificationGasLimit: utils.hexlify(300_000),
			preVerificationGas: utils.hexlify(40000),
			maxFeePerGas: utils.hexlify(gasPrice),
			maxPriorityFeePerGas: utils.hexlify(gasPrice),
			paymasterAndData: "0x",
			signature: "0x",
		};
		console.log("Inside prepareTransaction | Prepared user operation: ", userOperation);
		return userOperation;
	}

	private async signUserOperation(externalProvider: Web3Provider, userOperation: UserOperationStruct, options?: WalletStruct): Promise<UserOperationStruct> {
		const { signer, entryPoint } = await this.initParams(externalProvider, options);

		const signature = await signer.signMessage(utils.arrayify(await entryPoint.getUserOpHash(userOperation)));
		userOperation.signature = signature;

		console.log("Inside signUserOperation | Signed user Operation: ", userOperation);

		return userOperation;
	}

	private async getPaymasterSponsorship(chainId: number, userOperation: UserOperationStruct): Promise<UserOperationStruct> {
		try {
			const response = await axios.post(`${this.BASE_API_URL}/v1/transaction/payment-sponsorship`, {
				chainId: chainId,
				userOperation: userOperation,
			});
			// console.log(response);
			const updatedUserOperation = response?.data.data.userOperation;
			console.log("Inside getPaymasterSponsorship | Sponsored user operation: ", updatedUserOperation);
			return updatedUserOperation;
		} catch (e) {
			console.log("Error from getPaymasterSponsorship api call: ", e);
			return e;
		}
	}

	private async getPaymasterSponsorshipERC20(externalProvider: Web3Provider, chainId: number, userOperation, pimlicoApiKey: string, options?: WalletStruct): Promise<UserOperationStruct> {
		const { signer, entryPoint } = await this.initParams(externalProvider, options);
		// NOTE: Not getting used in this function
		// const chain = await getChainName(chainId); // find the list of chain names on the Pimlico verifying paymaster reference page
		// const pimlicoEndpoint = `https://api.pimlico.io/v1/${chain}/rpc?apikey=${pimlicoApiKey}`;
		// const pimlicoProvider = new StaticJsonRpcProvider(pimlicoEndpoint);

		const erc20Paymaster = await getERC20Paymaster(externalProvider, "USDC");
		const erc20PaymasterAddress = erc20Paymaster.contract.address;
		const usdcTokenAddress = await erc20Paymaster.contract.token();
		const usdcToken = ERC20__factory.connect(usdcTokenAddress, signer);
		const simpleAccount = SimpleAccount__factory.connect(erc20PaymasterAddress, externalProvider);

		console.log("Inside getPaymasterSponsorshipERC20 | userOperation: ", userOperation);
		const originalCallData = userOperation.callData;

		// Check if userOperation is a promise
		if (userOperation && typeof userOperation === "object" && typeof userOperation.then === "function") {
			console.log("Useropration is a promise");
		} else {
			console.log("Useropration is NOT a promise");
		}

		try {
			//@ts-ignore
			await erc20Paymaster.verifyTokenApproval(userOperation);
		} catch (e) {
			console.log("Inside getPaymasterSponsorshipERC20 | Error from verifyTokenApproval: ", e);
			// @ts-ignore
			const tokenAmount = await erc20Paymaster.calculateTokenAmount(userOperation);
			console.log("Inside getPaymasterSponsorshipERC20 | tokenAmount: ", tokenAmount.toNumber());

			// Note - We need to approve the paymaster to spend the USDC for gas
			const approveData = usdcToken.interface.encodeFunctionData("approve", [erc20PaymasterAddress, 10 * tokenAmount.toNumber()]);

			// GENERATE THE CALLDATA TO APPROVE THE USDC
			const to = usdcToken.address;
			const value = 0;
			const data = approveData;

			const callData = simpleAccount.interface.encodeFunctionData("execute", [to, value, data]);
			userOperation.callData = callData;

			const signedUserOperation = await this.signUserOperation(externalProvider, userOperation, options);
			console.log("Inside getPaymasterSponsorshipERC20 | ApproveUserOperation: ", signedUserOperation);
			await this.sendTransaction(externalProvider, signedUserOperation, options);
		}

		console.log("Inside getPaymasterSponsorshipERC20 | Enough tokens have been approved, sending the TXN now...");
		userOperation.callData = originalCallData;
		const nonce = await entryPoint.getNonce(userOperation.sender, 0);
		userOperation.nonce = utils.hexlify(nonce);

		const erc20PaymasterAndData = await erc20Paymaster.generatePaymasterAndData(userOperation);
		userOperation.paymasterAndData = erc20PaymasterAndData;
		console.log("Inside getPaymasterSponsorshipERC20 | Sponsored user operation: ", userOperation);
		const signedUserOperation2 = await this.signUserOperation(externalProvider, userOperation, options);
		console.log("Inside getPaymasterSponsorshipERC20 | originalUserOperation: ", signedUserOperation2);
		await this.sendTransaction(externalProvider, signedUserOperation2, options);

		return userOperation;
	}

	private async sendTransaction(externalProvider: Web3Provider, userOperation: UserOperationStruct, options?: WalletStruct): Promise<string> {
		//First find the native currency balance for the smartAccount
		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
		const eth_balance = await externalProvider.getBalance(smartAccountAddress);

		if (eth_balance < BigNumber.from(10)) {
			throw new Error("Insufficient balance in smart account");
		}

		try {
			const response = await axios.post(`${this.BASE_API_URL}/v1/transaction/send-transaction`, {
				chainId: options.chainId,
				userOperation: userOperation,
			});
			// console.log(response);
			const userOpHash = response?.data.data.userOpHash;
			console.log("UserOperation hash: ", userOpHash);
			return userOpHash;
		} catch (e) {
			console.log("Error from sendTransaction api call: ", e);
			return e;
		}
	}

	async sendGenericMessageTransaction(externalProvider: Web3Provider, to: string, value: number, options?: WalletStruct, data?: string): Promise<string> {
		const userOperation = await this.prepareTransaction(externalProvider, to, value, options, data);
		const signedUserOperation = await this.signUserOperation(externalProvider, userOperation, options);
		console.log("Inside sendGenericMessageTransaction, signedUserOperation = ", userOperation);
		return this.sendTransaction(externalProvider, signedUserOperation, options);
	}

	async sendGenericMessageTransactionGasless(externalProvider: Web3Provider, to: string, value: number, options?: WalletStruct, data?: string): Promise<string> {
		const userOperation = await this.prepareTransaction(externalProvider, to, value, options, data);
		const sponsoredUserOperation = await this.getPaymasterSponsorship(options.chainId, userOperation);
		const signedUserOperation = await this.signUserOperation(externalProvider, sponsoredUserOperation, options);
		console.log("Inside sendGenericMessageTransactionGasless, signedUserOperation = ", signedUserOperation);
		return this.sendTransaction(externalProvider, signedUserOperation, options);
	}

	async sendNativeCurrency(externalProvider: Web3Provider, to: string, value: number, options?: WalletStruct, data?: string): Promise<string> {
		const userOperation = await this.prepareTransaction(externalProvider, to, value, options, data);
		const signedUserOperation = await this.signUserOperation(externalProvider, userOperation, options);
		console.log("Inside sendNativeCurrency, signedUserOperation = ", userOperation);
		return this.sendTransaction(externalProvider, signedUserOperation, options);
	}

	async sendNativeCurrencyGasless(externalProvider: Web3Provider, to: string, value: number, options?: WalletStruct, data?: string): Promise<string> {
		const userOperation = await this.prepareTransaction(externalProvider, to, value, options, data);
		const sponsoredUserOperation = await this.getPaymasterSponsorship(options.chainId, userOperation);
		const signedUserOperation = await this.signUserOperation(externalProvider, sponsoredUserOperation, options);
		console.log("Inside sendNativeCurrencyGasless, signedUserOperation = ", signedUserOperation);
		return this.sendTransaction(externalProvider, signedUserOperation, options);
	}

	async sendNativeCurrencyERC20Gas(externalProvider: Web3Provider, to: string, value: number, options?: WalletStruct, data?: string, pimlicoApiKey?: string): Promise<boolean> {
		const userOperation = await this.prepareTransaction(externalProvider, to, value, options, data);
		const sponsoredUserOperation = await this.getPaymasterSponsorshipERC20(externalProvider, options.chainId, userOperation, pimlicoApiKey, options);
		// const signedUserOperation = await this.signUserOperation(externalProvider, sponsoredUserOperation, options);
		// console.log("Inside sendNativeCurrencyERC20Gas, signedUserOperation = ", signedUserOperation);
		// return this.sendTransaction(externalProvider, signedUserOperation, options, pimlicoApiKey);
		return true;
	}

	//TODO - Take token number as a string because it cannot handle big numbers
	async sendTokens(externalProvider: Web3Provider, to: string, numberTokensinWei: number, tokenAddress: string, options?: WalletStruct): Promise<string> {
		const erc20Token = ERC20__factory.connect(tokenAddress, externalProvider);
		const data = erc20Token.interface.encodeFunctionData("transfer", [to, numberTokensinWei]);
		const userOperation = await this.prepareTransaction(externalProvider, tokenAddress, 0, options, data);
		const signedUserOperation = await this.signUserOperation(externalProvider, userOperation, options);
		console.log("Inside sendTokens, signedUserOperation = ", signedUserOperation);
		return this.sendTransaction(externalProvider, signedUserOperation, options);
	}

	async sendTokensBatch(externalProvider: Web3Provider, to: string[], numberTokensinWei: number[], tokenAddress: string[], options?: WalletStruct): Promise<string> {
		if (to.length !== tokenAddress.length || to.length !== numberTokensinWei.length || tokenAddress.length !== numberTokensinWei.length) {
			throw new Error("to and value arrays must be of the same length");
		}

		const erc20Tokens = tokenAddress.map((tokenAddress) => ERC20__factory.connect(tokenAddress, externalProvider));
		const data = erc20Tokens.map((erc20Token, index) => erc20Token.interface.encodeFunctionData("transfer", [to[index], numberTokensinWei[index]]));

		const userOperation = await this.prepareBatchTransaction(externalProvider, tokenAddress, data, options);
		const signedUserOperation = await this.signUserOperation(externalProvider, userOperation, options);
		console.log("Inside sendTokensBatch, signedUserOperation = ", signedUserOperation);
		return this.sendTransaction(externalProvider, signedUserOperation, options);
	}

	async sendTokensGasless(externalProvider: Web3Provider, to: string, numberTokensinWei: number, tokenAddress: string, options?: WalletStruct): Promise<string> {
		const erc20Token = ERC20__factory.connect(tokenAddress, externalProvider);
		const data = erc20Token.interface.encodeFunctionData("transfer", [to, numberTokensinWei]);
		const userOperation = await this.prepareTransaction(externalProvider, tokenAddress, 0, options, data);
		const sponsoredUserOperation = await this.getPaymasterSponsorship(options.chainId, userOperation);
		const signedUserOperation = await this.signUserOperation(externalProvider, sponsoredUserOperation, options);
		console.log("Inside sendTokensGasless, signedUserOperation = ", signedUserOperation);

		return this.sendTransaction(externalProvider, signedUserOperation, options);
	}

	async getNativeCurrencyBalance(externalProvider, options?: WalletStruct): Promise<number> {
		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
		const balance = await externalProvider.getBalance(smartAccountAddress);
		const formatted_balance = Math.floor(parseFloat(utils.formatEther(balance)) * 100000) / 100000;
		console.log("Inside getNativeCurrencyBalance | Native currency balance: ", formatted_balance);

		return formatted_balance;
	}

	async getERC20TokenBalance(externalProvider: Web3Provider, tokenAddress: string, options?: WalletStruct): Promise<number> {
		const erc20Token = ERC20__factory.connect(tokenAddress, externalProvider);
		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
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
		const erc20Tokens = tokenAddresses.map((tokenAddress) => ERC20__factory.connect(tokenAddress, externalProvider));
		const balancePromises = erc20Tokens.map((erc20Token) => erc20Token.balanceOf(smartAccountAddress));
		const balances = await Promise.all(balancePromises);
		const formatted_balances = balances.map((balance) => Math.floor(parseFloat(utils.formatEther(balance)) * 100) / 100);
		console.log("Inside getERC20TokenBalanceBatch | ERC20 token balances: ", formatted_balances);

		return formatted_balances;
	}

	async isSmartAccountDeployed(externalProvider: Web3Provider, options?: WalletStruct): Promise<boolean> {
		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
		const contractCode = await externalProvider.getCode(smartAccountAddress);
		console.log("Inside isSmartAccountDeployed | Smart account code: ", contractCode);

		return contractCode !== "0x";
	}

	async getTransactionReceiptByUserOpHash(userOpHash: string, chainId: number): Promise<Object> {
		try {
			const response = await axios.get(`${this.BASE_API_URL}/v1/transaction/receipt/${chainId}/${userOpHash}`);
			console.log(response);
			const trxReceipt = response?.data.data.trxReceipt;
			console.log("Inside getTransactionReceiptByUserOpHash | UserOperation hash:", trxReceipt);
			return trxReceipt;
		} catch (e) {
			console.log("Error from getTransactionReceiptByUserOpHash api call: ", e.message);
			return e.message;
		}
	}

	async getEntryPointDeposit(externalProvider: Web3Provider, options?: WalletStruct): Promise<number> {
		const { signer, simpleAccountFactory } = await this.initParams(externalProvider, options);
		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
		const simpleAccount = SimpleAccount__factory.connect(smartAccountAddress, signer);
		const deposit = await simpleAccount.getDeposit();
		// Convert deposit to ETH
		const formatted_deposit = Math.floor(parseFloat(utils.formatEther(deposit)) * 100000000000) / 100000000000;
		console.log("Inside getEntryPointDeposit | Deposit: ", formatted_deposit);

		return formatted_deposit;
	}

	//TODO - Add functionality to withdraw deposit from the entry point directly without having to go through the smart account
	async withdrawDepositFromEntryPoint(externalProvider: Web3Provider, options?: WalletStruct): Promise<boolean> {
		const { signer, entryPoint } = await this.initParams(externalProvider, options);
		const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
		const simpleAccount = SimpleAccount__factory.connect(smartAccountAddress, signer);
		const deposit = await simpleAccount.getDeposit();
		console.log("Inside withdrawDepositFromEntryPoint | Deposit: ", deposit.toNumber());

		const withdrawTx = await simpleAccount.withdrawDepositTo(smartAccountAddress, deposit.toNumber() / 5);
		await withdrawTx.wait();

		console.log("Inside withdrawDepositFromEntryPoint | Withdraw transaction hash: ", withdrawTx.hash);
		return true;
	}
}

