import { Base } from "../../base";
import { SampleOptions, SampleResponse, WalletStruct } from "./types";
import { SimpleAccountFactory__factory, EntryPoint__factory, SimpleAccount__factory, EntryPoint, UserOperationStruct } from "@account-abstraction/contracts";
import { Provider, StaticJsonRpcProvider, Web3Provider } from "@ethersproject/providers";
import { Wallet, constants, utils, ethers } from "ethers";
import { BaseContract, BigNumber, BigNumberish, BytesLike, CallOverrides, ContractTransaction, Overrides, PayableOverrides, PopulatedTransaction, Signer } from "ethers";
import { getChainName } from "../../helper";
import axios from "axios";
import { ECDSAKernelFactory__factory, Kernel__factory } from "./contracts";

const dotenv = require("dotenv");

dotenv.config();

const resourceName = "smartWallet";

export class SmartWallet extends Base {
	ECDSAKernelFactory_Address = "0xf7d5E0c8bDC24807c8793507a2aF586514f4c46e";
	ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
	//TO DO: CHANGE BEFORE DEPLOYMENT
	BASE_API_URL = "http://localhost:3000";

	init(): Promise<void> {
		//execute initialization steps
		return;
	}

	private async initParams(externalProvider: Web3Provider, options?: WalletStruct) {
		let signer, wallet;
		try {
			const address = await externalProvider.getSigner().getAddress();
			signer = externalProvider.getSigner();
		} catch (e) {
			signer = new Wallet(options.privateKey, externalProvider);
		}

		const entryPoint = EntryPoint__factory.connect(this.ENTRY_POINT_ADDRESS, signer);
		const kernelAccountFactory = ECDSAKernelFactory__factory.connect(this.ECDSAKernelFactory_Address, signer);
		return { signer, entryPoint, kernelAccountFactory };
	}

	async getSmartAccountAddress(externalProvider: Web3Provider, options?: WalletStruct) {
		const { signer, entryPoint, kernelAccountFactory } = await this.initParams(externalProvider, options);
		// TODO - Make the 2nd argument to createAccount configurable - this is the "salt" which determines the address of the smart account
		const signerAddress = await signer.getAddress();
		const smartAccountAddress = await kernelAccountFactory.getAccountAddress(signerAddress, 0);
		console.log("Using Smart Wallet:", smartAccountAddress);
		return { smartAccountAddress, signerAddress };
	}

	//TODO - Feature - Enable creating this Smart Account on multiple chains
	async initSmartAccount(externalProvider: Web3Provider, options?: WalletStruct): Promise<boolean> {
		const { signer, kernelAccountFactory } = await this.initParams(externalProvider, options);

		const createTx = await kernelAccountFactory.createAccount(await signer.getAddress(), 0, {
			gasLimit: 300000,
		});
		await createTx.wait();
		console.log("Created smart account", createTx.hash);

		return true;
	}

	async prepareTransaction(externalProvider: Web3Provider, to: string, value: number, options?: WalletStruct, data?: string): Promise<UserOperationStruct> {
		const { signer, entryPoint, kernelAccountFactory } = await this.initParams(externalProvider, options);
		const { smartAccountAddress, signerAddress } = await this.getSmartAccountAddress(externalProvider, options);
		const kernelAccount = Kernel__factory.connect(smartAccountAddress, externalProvider);

		//TODO - make this customizable based on the type of transaction
		// 0 = call, 1 = delegatecall (type of Operation)
		const callData = kernelAccount.interface.encodeFunctionData("execute", [to, value, data, 0]);
		const initCode = utils.hexConcat([this.ECDSAKernelFactory_Address, kernelAccountFactory.interface.encodeFunctionData("createAccount", [signerAddress, 0])]);
		const gasPrice = await externalProvider.getGasPrice();

		//Check if the smart account contract has been deployed
		const contractCode = await externalProvider.getCode(smartAccountAddress);
		let nonce;
		if (contractCode === "0x") {
			nonce = 0;
		} else {
			nonce = await entryPoint.callStatic.getNonce(smartAccountAddress, 0);
		}
		const userOperation = {
			sender: smartAccountAddress,
			nonce: utils.hexlify(nonce),
			initCode: contractCode === "0x" ? initCode : "0x",
			callData,
			callGasLimit: utils.hexlify(75_000),
			verificationGasLimit: utils.hexlify(100_000),
			preVerificationGas: utils.hexlify(45000),
			maxFeePerGas: utils.hexlify(gasPrice),
			maxPriorityFeePerGas: utils.hexlify(gasPrice),
			paymasterAndData: "0x",
			signature: "0x",
		};
		console.log("Inside prepareTransaction | Prepared user operation: ", userOperation);
		return userOperation;
	}

	// private async prepareBatchTransaction(externalProvider: Web3Provider, to: string[], data: string[], value: number[], options?: WalletStruct): Promise<UserOperationStruct> {
	// 	const { signer, entryPoint, kernelAccountFactory } = await this.initParams(externalProvider, options);
	// 	const smartAccountAddress = await this.getSmartAccountAddress(externalProvider, options);
	// 	const kernelAccount = Kernel__factory.connect(smartAccountAddress, externalProvider);

	// 	const callData = kernelAccount.interface.encodeFunctionData("executeBatch", [to, value, data, ]);
	// 	const initCode = utils.hexConcat([this.ECDSAKernelFactory_Address, kernelAccountFactory.interface.encodeFunctionData("createAccount", [await signer.getAddress(), 0])]);
	// 	const gasPrice = await externalProvider.getGasPrice();

	// 	//Check if the smart account contract has been deployed
	// 	const contractCode = await externalProvider.getCode(smartAccountAddress);
	// 	let nonce;
	// 	if (contractCode === "0x") {
	// 		nonce = 0;
	// 	} else {
	// 		nonce = await kernelAccount.callStatic.getNonce();
	// 		console.log("| Nonce: ", nonce);
	// 	}

	// 	const userOperation = {
	// 		sender: smartAccountAddress,
	// 		nonce: utils.hexlify(nonce),
	// 		initCode: contractCode === "0x" ? initCode : "0x",
	// 		callData,
	// 		callGasLimit: utils.hexlify(80_000),
	// 		verificationGasLimit: utils.hexlify(300_000),
	// 		preVerificationGas: utils.hexlify(40000),
	// 		maxFeePerGas: utils.hexlify(gasPrice),
	// 		maxPriorityFeePerGas: utils.hexlify(gasPrice),
	// 		paymasterAndData: "0x",
	// 		signature: "0x",
	// 	};
	// 	console.log("Inside prepareTransaction | Prepared user operation: ", userOperation);
	// 	return userOperation;
	// }

	async signUserOperation(externalProvider: Web3Provider, userOperation: UserOperationStruct, options?: WalletStruct): Promise<UserOperationStruct> {
		const { signer, entryPoint } = await this.initParams(externalProvider, options);

		const signature = await signer.signMessage(utils.arrayify(await entryPoint.getUserOpHash(userOperation)));
		const padding = "0x00000000";
		const signatureWithPadding = utils.hexConcat([padding, signature]);
		userOperation.signature = signatureWithPadding;

		console.log("Inside signUserOperation | Signed user Operation: ", userOperation);

		return userOperation;
	}

	async getPaymasterSponsorship(chainId: number, userOperation: UserOperationStruct): Promise<UserOperationStruct> {
		try {
			console.log("========== Calling Pimlico Paymaster to sponsor gas ==========");
			const response = await axios.post(`${this.BASE_API_URL}/v1/transaction/payment-sponsorship`, {
				chainId: chainId,
				userOperation: userOperation,
			});
			await new Promise((resolve) => setTimeout(resolve, 2000));
			const updatedUserOperation = response?.data.data.userOperation;
			console.log("Inside getPaymasterSponsorship | Sponsored user operation: ", updatedUserOperation);
			return updatedUserOperation;
		} catch (e) {
			console.log("Error from getPaymasterSponsorship api call: ", e);
			return e;
		}
	}

	// async getPaymasterSponsorshipERC20(externalProvider: Web3Provider, chainId: number, userOperation, pimlicoApiKey: string, options?: WalletStruct): Promise<UserOperationStruct> {
	// 	const { signer, entryPoint } = await this.initParams(externalProvider, options);

	// 	const erc20Paymaster = await getERC20Paymaster(externalProvider, "USDC");
	// 	const erc20PaymasterAddress = erc20Paymaster.contract.address;
	// 	const usdcTokenAddress = await erc20Paymaster.contract.token();
	// 	const usdcToken = ERC20__factory.connect(usdcTokenAddress, signer);
	// 	const kernelAccount = Kernel__factory.connect(erc20PaymasterAddress, externalProvider);

	// 	console.log("Inside getPaymasterSponsorshipERC20 | userOperation: ", userOperation);
	// 	const originalCallData = userOperation.callData;

	// 	// Check if userOperation is a promise
	// 	if (userOperation && typeof userOperation === "object" && typeof userOperation.then === "function") {
	// 		console.log("Useropration is a promise");
	// 	} else {
	// 		console.log("Useropration is NOT a promise");
	// 	}

	// 	try {
	// 		//@ts-ignore
	// 		await erc20Paymaster.verifyTokenApproval(userOperation);
	// 	} catch (e) {
	// 		console.log("Inside getPaymasterSponsorshipERC20 | Error from verifyTokenApproval: ", e);
	// 		// @ts-ignore
	// 		const tokenAmount = await erc20Paymaster.calculateTokenAmount(userOperation);
	// 		console.log("Inside getPaymasterSponsorshipERC20 | tokenAmount: ", tokenAmount.toNumber());

	// 		// Note - We need to approve the paymaster to spend the USDC for gas
	// 		const approveData = usdcToken.interface.encodeFunctionData("approve", [erc20PaymasterAddress, 10 * tokenAmount.toNumber()]);

	// 		// GENERATE THE CALLDATA TO APPROVE THE USDC
	// 		const to = usdcToken.address;
	// 		const value = 0;
	// 		const data = approveData;

	// 		const callData = kernelAccount.interface.encodeFunctionData("execute", [to, value, data, "1"]);
	// 		userOperation.callData = callData;

	// 		const signedUserOperation = await this.signUserOperation(externalProvider, userOperation, options);
	// 		console.log("Inside getPaymasterSponsorshipERC20 | ApproveUserOperation: ", signedUserOperation);
	// 		await this.sendTransaction(externalProvider, signedUserOperation, options);
	// 	}

	// 	console.log("Inside getPaymasterSponsorshipERC20 | Enough tokens have been approved, sending the TXN now...");
	// 	userOperation.callData = originalCallData;
	// 	const nonce = await entryPoint.getNonce(userOperation.sender, 0);
	// 	userOperation.nonce = utils.hexlify(nonce);

	// 	const erc20PaymasterAndData = await erc20Paymaster.generatePaymasterAndData(userOperation);
	// 	userOperation.paymasterAndData = erc20PaymasterAndData;
	// 	console.log("Inside getPaymasterSponsorshipERC20 | Sponsored user operation: ", userOperation);
	// 	const signedUserOperation2 = await this.signUserOperation(externalProvider, userOperation, options);
	// 	console.log("Inside getPaymasterSponsorshipERC20 | originalUserOperation: ", signedUserOperation2);
	// 	await this.sendTransaction(externalProvider, signedUserOperation2, options);

	// 	return userOperation;
	// }

	async sendTransaction(externalProvider: Web3Provider, userOperation: UserOperationStruct, options?: WalletStruct): Promise<string> {
		//First find the native currency balance for the smartAccount
		const { smartAccountAddress } = await this.getSmartAccountAddress(externalProvider, options);
		const eth_balance = await externalProvider.getBalance(smartAccountAddress);

		if (eth_balance < BigNumber.from(10)) {
			throw new Error("Insufficient balance in smart account");
		}

		try {
			console.log("========== Sending transaction through Pimlico bundler ==========");
			const response = await axios.post(`${this.BASE_API_URL}/v1/transaction/send-transaction`, {
				chainId: options.chainId,
				userOperation: userOperation,
			});
			await new Promise((resolve) => setTimeout(resolve, 2000));
			const userOpHash = response?.data.data.userOpHash;
			return userOpHash;
		} catch (e) {
			console.log("Error from sendTransaction api call: ", e);
			return e;
		}
	}

	// async sendNativeCurrencyERC20Gas(externalProvider: Web3Provider, to: string, value: number, options?: WalletStruct, data?: string, pimlicoApiKey?: string): Promise<boolean> {
	// 	const userOperation = await this.prepareTransaction(externalProvider, to, value, options, data);
	// 	const sponsoredUserOperation = await this.getPaymasterSponsorshipERC20(externalProvider, options.chainId, userOperation, pimlicoApiKey, options);
	// 	// const signedUserOperation = await this.signUserOperation(externalProvider, sponsoredUserOperation, options);
	// 	// console.log("Inside sendNativeCurrencyERC20Gas, signedUserOperation = ", signedUserOperation);
	// 	// return this.sendTransaction(externalProvider, signedUserOperation, options, pimlicoApiKey);
	// 	return true;
	// }

	// async getERC20TokenBalanceBatch(externalProvider: Web3Provider, tokenAddresses: string[], options?: WalletStruct): Promise<number[]> {
	// 	if (tokenAddresses.length > 100) {
	// 		throw new Error("Can return maximum 100 balances at a time");
	// 	}

	// 	const { smartAccountAddress } = await this.getSmartAccountAddress(externalProvider, options);
	// 	const erc20Tokens = tokenAddresses.map((tokenAddress) => ERC20__factory.connect(tokenAddress, externalProvider));
	// 	const balancePromises = erc20Tokens.map((erc20Token) => erc20Token.balanceOf(smartAccountAddress));
	// 	const balances = await Promise.all(balancePromises);
	// 	const formatted_balances = balances.map((balance) => Math.floor(parseFloat(utils.formatEther(balance)) * 100) / 100);
	// 	console.log("Inside getERC20TokenBalanceBatch | ERC20 token balances: ", formatted_balances);

	// 	return formatted_balances;
	// }

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
}

