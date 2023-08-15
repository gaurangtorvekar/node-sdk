import { Base } from "../../base";
import * as aaContracts from "@account-abstraction/contracts";
import { Web3Provider } from "@ethersproject/providers";
import { Wallet, utils, Contract, BigNumber } from "ethers";
import axios from "axios";
import { ECDSAKernelFactory__factory, Kernel__factory, BatchActions__factory, ECDSAValidator__factory } from "./contracts";
import { BastionSignerOptions, BasicTransaction } from "../bastionConnect";

const dotenv = require("dotenv");

dotenv.config();

const resourceName = "smartWallet";

export class SmartWallet extends Base {
	ECDSAKernelFactory_Address = "0xf7d5E0c8bDC24807c8793507a2aF586514f4c46e";
	ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
	BATCH_ACTIONS_EXECUTOR = "0xF3F98574AC89220B5ae422306dC38b947901b421";
	//TO DO: CHANGE BEFORE DEPLOYMENT
	BASE_API_URL = "http://localhost:3000";
	SMART_ACCOUNT_SALT = 1;

	init(): Promise<void> {
		//execute initialization steps
		return;
	}

	private async initParams(externalProvider: Web3Provider, options?: BastionSignerOptions) {
		let signer, wallet;
		try {
			const address = await externalProvider.getSigner().getAddress();
			signer = externalProvider.getSigner();
		} catch (e) {
			signer = new Wallet(options.privateKey, externalProvider);
		}

		const entryPoint = aaContracts.EntryPoint__factory.connect(this.ENTRY_POINT_ADDRESS, signer);
		const kernelAccountFactory = ECDSAKernelFactory__factory.connect(this.ECDSAKernelFactory_Address, signer);
		return { signer, entryPoint, kernelAccountFactory };
	}

	// TODO - make sure that setExecution has been called on the smart account
	async getSmartAccountAddress(externalProvider: Web3Provider, options?: BastionSignerOptions) {
		const { signer, entryPoint, kernelAccountFactory } = await this.initParams(externalProvider, options);
		// TODO - Make the 2nd argument to createAccount configurable - this is the "salt" which determines the address of the smart account
		const signerAddress = await signer.getAddress();
		const smartAccountAddress = await kernelAccountFactory.getAccountAddress(signerAddress, this.SMART_ACCOUNT_SALT);
		console.log("Using Smart Wallet:", smartAccountAddress);
		return { smartAccountAddress, signerAddress };
	}

	// TODO - Feature - Enable creating this Smart Account on multiple chains
	// TODO - Do this from the API so that Bastion is creating Smart Accounts for customers
	async initSmartAccount(externalProvider: Web3Provider, options?: BastionSignerOptions): Promise<boolean> {
		const { signer, kernelAccountFactory } = await this.initParams(externalProvider, options);
		const { smartAccountAddress, signerAddress } = await this.getSmartAccountAddress(externalProvider, options);

		const contractCode = await externalProvider.getCode(smartAccountAddress);

		if (contractCode === "0x") {
			const createTx = await kernelAccountFactory.createAccount(await signer.getAddress(), this.SMART_ACCOUNT_SALT, {
				gasLimit: 300000,
			});
			await createTx.wait();
		}

		// console.log("Inside initSmartAccount | Setting execution ======= ");
		// const kernelAccount = await Kernel__factory.connect(smartAccountAddress, signer);
		// // const ecdsaValidator = ECDSAValidator__factory.connect("0x180D6465F921C7E0DEA0040107D342c87455fFF5", signer);
		// // const validator = new Contract("0x180D6465F921C7E0DEA0040107D342c87455fFF5", ecdsaValidator.interface, externalProvider);

		// const batchActionsInterface = new utils.Interface(["function executeBatch(address[] memory to, uint256[] memory value, bytes[] memory data, uint8 operation) external"]);
		// const funcSignature = batchActionsInterface.getSighash("executeBatch(address[],uint256[], bytes[], uint8)");
		// console.log("funcSignature = ", funcSignature);

		// // Valid until 2030
		// const validUntil = 1893456000;

		// // Valid after current block timestamp
		// // Get latest block
		// const block = await externalProvider.getBlock("latest");
		// // Get block timestamp
		// const timestamp = block.timestamp;
		// // Create validAfter param
		// const validAfter = BigNumber.from(timestamp);

		// // Encode owner address
		// const owner = await signer.getAddress();
		// const enableData = utils.defaultAbiCoder.encode(["address"], [owner]);

		// const setExecutionTx = await kernelAccount.setExecution(funcSignature, this.BATCH_ACTIONS_EXECUTOR, "0x180D6465F921C7E0DEA0040107D342c87455fFF5", validUntil, validAfter, enableData);
		// await setExecutionTx.wait();
		// console.log("Set execution =======", setExecutionTx.hash);
		return true;
	}

	async prepareTransaction(externalProvider: Web3Provider, to: string, value: number, options?: BastionSignerOptions, data?: string): Promise<aaContracts.UserOperationStruct> {
		const { signer, entryPoint, kernelAccountFactory } = await this.initParams(externalProvider, options);
		const { smartAccountAddress, signerAddress } = await this.getSmartAccountAddress(externalProvider, options);
		const kernelAccount = Kernel__factory.connect(smartAccountAddress, externalProvider);

		//TODO - make this customizable based on the type of transaction
		// 0 = call, 1 = delegatecall (type of Operation)
		const callData = kernelAccount.interface.encodeFunctionData("execute", [to, value, data, 0]);
		let initCode = utils.hexConcat([this.ECDSAKernelFactory_Address, kernelAccountFactory.interface.encodeFunctionData("createAccount", [signerAddress, this.SMART_ACCOUNT_SALT])]);
		console.log("Inside prepareTransaction | initCode: ", initCode);
		const gasPrice = await externalProvider.getGasPrice();

		//Check if the smart account contract has been deployed
		const contractCode = await externalProvider.getCode(smartAccountAddress);
		let nonce;
		if (contractCode === "0x") {
			nonce = 0;
			await this.initSmartAccount(externalProvider, options);
			initCode = "0x";
		} else {
			nonce = await entryPoint.callStatic.getNonce(smartAccountAddress, 0);
			console.log("Nonce = ", nonce.toNumber());
		}
		const userOperation = {
			sender: smartAccountAddress,
			nonce: utils.hexlify(nonce),
			initCode: contractCode === "0x" ? initCode : "0x",
			callData,
			callGasLimit: utils.hexlify(150_000),
			verificationGasLimit: utils.hexlify(500_000),
			preVerificationGas: utils.hexlify(100_000),
			maxFeePerGas: utils.hexlify(gasPrice),
			maxPriorityFeePerGas: utils.hexlify(gasPrice),
			paymasterAndData: "0x",
			signature: "0x",
		};
		console.log("Inside prepareTransaction | Prepared user operation: ", userOperation);
		return userOperation;
	}

	async prepareBatchTransaction(externalProvider: Web3Provider, to: string[], data: string[], value: number[], options?: BastionSignerOptions): Promise<aaContracts.UserOperationStruct> {
		const { signer, entryPoint, kernelAccountFactory } = await this.initParams(externalProvider, options);
		const { smartAccountAddress, signerAddress } = await this.getSmartAccountAddress(externalProvider, options);
		const batchActions = BatchActions__factory.connect(smartAccountAddress, externalProvider);

		//TODO - make this customizable based on the type of transaction
		// 0 = call, 1 = delegatecall (type of Operation)
		const callData = batchActions.interface.encodeFunctionData("executeBatch", [to, value, data, 0]);
		// let initCode = utils.hexConcat([this.ECDSAKernelFactory_Address, kernelAccountFactory.interface.encodeFunctionData("createAccount", [signerAddress, this.SMART_ACCOUNT_SALT])]);
		// console.log("Inside prepareTransaction | initCode: ", initCode);
		const gasPrice = await externalProvider.getGasPrice();

		//Check if the smart account contract has been deployed
		const contractCode = await externalProvider.getCode(smartAccountAddress);
		let nonce;
		if (contractCode === "0x") {
			nonce = 0;
			await this.initSmartAccount(externalProvider, options);
			// initCode = "0x";
		} else {
			nonce = await entryPoint.callStatic.getNonce(smartAccountAddress, 0);
			console.log("Nonce = ", nonce.toNumber());
		}
		const userOperation = {
			sender: smartAccountAddress,
			nonce: utils.hexlify(nonce),
			initCode: "0x",
			callData,
			callGasLimit: utils.hexlify(150_000),
			verificationGasLimit: utils.hexlify(500_000),
			preVerificationGas: utils.hexlify(100_000),
			maxFeePerGas: utils.hexlify(gasPrice),
			maxPriorityFeePerGas: utils.hexlify(gasPrice),
			paymasterAndData: "0x",
			signature: "0x",
		};
		console.log("Inside prepareTransaction | Prepared user operation: ", userOperation);
		return userOperation;
	}

	async signUserOperation(externalProvider: Web3Provider, userOperation: aaContracts.UserOperationStruct, options?: BastionSignerOptions): Promise<aaContracts.UserOperationStruct> {
		const { signer, entryPoint } = await this.initParams(externalProvider, options);

		const signature = await signer.signMessage(utils.arrayify(await entryPoint.getUserOpHash(userOperation)));
		const padding = "0x00000000";
		const signatureWithPadding = utils.hexConcat([padding, signature]);
		userOperation.signature = signatureWithPadding;

		console.log("Inside signUserOperation | Signed user Operation: ", userOperation);

		return userOperation;
	}

	private async getSponsorship(chainId: number, userOperation: aaContracts.UserOperationStruct, endpoint: string, erc20Token?: string): Promise<aaContracts.UserOperationStruct> {
		try {
			console.log("========== Calling Pimlico Paymaster to sponsor gas ==========");
			const payload = { chainId, userOperation };
			if (erc20Token) payload["erc20Token"] = erc20Token;

			const response = await axios.post(`${this.BASE_API_URL}${endpoint}`, payload);
			const updatedUserOperation = response?.data?.data?.paymasterDataResponse?.userOperation;

			console.log("Inside getSponsorship | Sponsored user operation: ", updatedUserOperation);
			return updatedUserOperation;
		} catch (e) {
			console.log("Error from getSponsorship api call: ", e.response.data);
			throw e;
		}
	}

	async getPaymasterSponsorship(chainId: number, userOperation: aaContracts.UserOperationStruct): Promise<aaContracts.UserOperationStruct> {
		try {
			return await this.getSponsorship(chainId, userOperation, "/v1/transaction/payment-sponsorship");
		} catch (error) {
			throw error;
		}
	}

	async getPaymasterSponsorshipERC20(chainId: number, userOperation: aaContracts.UserOperationStruct, erc20Token: string): Promise<aaContracts.UserOperationStruct> {
		try {
			return await this.getSponsorship(chainId, userOperation, "/v1/transaction/payment-sponsorship-erc20", erc20Token);
		} catch (error) {
			throw error;
		}
	}

	async sendTransaction(externalProvider: Web3Provider, userOperation: aaContracts.UserOperationStruct, options?: BastionSignerOptions): Promise<string> {
		try {
			console.log("========== Sending transaction through bundler ==========");
			const response = await axios.post(`${this.BASE_API_URL}/v1/transaction/send-transaction`, {
				chainId: options.chainId,
				userOperation: userOperation,
			});
			const sendTransactionResponse = response?.data.data.sendTransactionResponse;
			return sendTransactionResponse;
		} catch (e) {
			console.log("Error from sendTransaction api call: ", e.response.data);
			throw e;
		}
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
}

