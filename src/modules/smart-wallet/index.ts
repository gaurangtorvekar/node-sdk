import * as aaContracts from "@account-abstraction/contracts";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet, utils, BigNumber } from "ethers";
import axios from "axios";
import { ECDSAKernelFactory__factory, Kernel__factory, BatchActions__factory } from "./contracts";
import { BastionSignerOptions } from "../bastionConnect";

export interface SendTransactionResponse {
	bundler: string;
	bundlerURL: string;
	chainId: number;
	userOperationHash: string;
}

export class SmartWallet {
	ECDSAKernelFactory_Address = "0xf7d5E0c8bDC24807c8793507a2aF586514f4c46e";
	ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
	BATCH_ACTIONS_EXECUTOR = "0xaEA978bAa9357C7d2B3B2D243621B94ce3d5793F";
	VALIDATOR_ADDRESS = "0x180D6465F921C7E0DEA0040107D342c87455fFF5";
	BASE_API_URL = "https://api.bastionwallet.io";
	SALT = 0;

	async initParams(externalProvider: JsonRpcProvider, options?: BastionSignerOptions) {
		let signer;
		try {
			const address = await externalProvider.getSigner().getAddress();
			signer = externalProvider.getSigner();
		} catch (e) {
			signer = new Wallet(options.privateKey, externalProvider);
		}

		const entryPoint = aaContracts.EntryPoint__factory.connect(this.ENTRY_POINT_ADDRESS, signer);
		const kernelAccountFactory = ECDSAKernelFactory__factory.connect(this.ECDSAKernelFactory_Address, signer);
		const signerAddress = await signer.getAddress();
		const smartAccountAddress = await kernelAccountFactory.getAccountAddress(signerAddress, this.SALT);

		console.log("Inside initParams | Smart Account Address: ", smartAccountAddress);

		return { signer, entryPoint, kernelAccountFactory, smartAccountAddress, signerAddress };
	}

	async initSmartAccount(externalProvider: JsonRpcProvider, smartAccountAddress: string, signerAddress: string, chainId: number, apiKey: string): Promise<boolean> {
		const contractCode = await externalProvider.getCode(smartAccountAddress);
		const headers = {
			"x-api-key": apiKey,
		};
		// If the smart account has not been deployed, deploy it
		if (contractCode === "0x") {
			const response = await axios.post(
				`${this.BASE_API_URL}/v1/transaction/create-account`,
				{
					chainId: chainId,
					eoa: signerAddress,
					salt: this.SALT,
				},
				{ headers }
			);
			return false;
		} else {
			return true;
		}
	}

	async checkExecutionSet(externalProvider: JsonRpcProvider, options?: BastionSignerOptions) {
		const { smartAccountAddress, signer } = await this.initParams(externalProvider, options);
		const kernelAccount = await Kernel__factory.connect(smartAccountAddress, signer);

		const batchActionsInterface = new utils.Interface(["function executeBatch(address[] memory to, uint256[] memory value, bytes[] memory data, uint8 operation) external"]);
		const funcSignature = await batchActionsInterface.getSighash("executeBatch(address[],uint256[], bytes[], uint8)");

		// First get the execution details from kernerlAccount
		const executionDetails = await kernelAccount.getExecution(funcSignature);
		// Only set the execution if it hasn't been set already
		if (executionDetails[0] === 0) {
			// Valid until 2030
			const validUntil = 1893456000;

			// Valid after current block timestamp
			const block = await externalProvider.getBlock("latest");
			const timestamp = block.timestamp;
			const validAfter = BigNumber.from(timestamp);

			// Encode packed owner address
			const owner = await signer.getAddress();
			const ownerSliced = owner.slice(2).padStart(40, "0");
			const packedData = utils.arrayify("0x" + ownerSliced);

			const setExecutionCallData = await kernelAccount.interface.encodeFunctionData("setExecution", [
				funcSignature,
				this.BATCH_ACTIONS_EXECUTOR,
				this.VALIDATOR_ADDRESS,
				validUntil,
				validAfter,
				packedData,
			]);

			const userOperation = await this.prepareTransaction(externalProvider, smartAccountAddress, 0, options, setExecutionCallData);
			const sponsoredUserOperation = await this.getPaymasterSponsorship(options.chainId, userOperation, options.apiKey);
			const signedUserOperation = await this.signUserOperation(externalProvider, sponsoredUserOperation, options);
			await this.sendTransaction(externalProvider, signedUserOperation, options);

			// Check execution details again for sanity
			const executionDetails = await kernelAccount.getExecution(funcSignature);
		}
	}

	async prepareTransaction(externalProvider: JsonRpcProvider, to: string, value: number, options?: BastionSignerOptions, data?: string): Promise<aaContracts.UserOperationStruct> {
		const { smartAccountAddress, entryPoint, signerAddress } = await this.initParams(externalProvider, options);
		const kernelAccount = Kernel__factory.connect(smartAccountAddress, externalProvider);

		// 0 = call, 1 = delegatecall (type of Operation)
		const callData = kernelAccount.interface.encodeFunctionData("execute", [to, value, data, 0]);
		// let initCode = utils.hexConcat([this.ECDSAKernelFactory_Address, kernelAccountFactory.interface.encodeFunctionData("createAccount", [signerAddress, this.SMART_ACCOUNT_SALT])]);
		const gasPrice = await externalProvider.getGasPrice();

		// Check if the smart account contract has been deployed and setExecution has been called
		const smartWalletDeployed = await this.initSmartAccount(externalProvider, smartAccountAddress, signerAddress, options.chainId, options.apiKey);

		let nonce;
		if (!smartWalletDeployed) {
			nonce = 0;
		} else {
			nonce = await entryPoint.callStatic.getNonce(smartAccountAddress, 0);
		}
		const userOperation = {
			sender: smartAccountAddress,
			nonce: utils.hexlify(nonce),
			initCode: "0x",
			callData,
			callGasLimit: utils.hexlify(250_000),
			verificationGasLimit: utils.hexlify(600_000),
			preVerificationGas: utils.hexlify(200_000),
			maxFeePerGas: utils.hexlify(gasPrice),
			maxPriorityFeePerGas: utils.hexlify(gasPrice),
			paymasterAndData: "0x",
			signature: "0x",
		};
		return userOperation;
	}

	async prepareBatchTransaction(externalProvider: JsonRpcProvider, to: string[], data: string[], value: number[], options?: BastionSignerOptions): Promise<aaContracts.UserOperationStruct> {
		const { smartAccountAddress, entryPoint, signerAddress } = await this.initParams(externalProvider, options);
		const batchActions = BatchActions__factory.connect(smartAccountAddress, externalProvider);

		// 0 = call, 1 = delegatecall (type of Operation)
		const callData = batchActions.interface.encodeFunctionData("executeBatch", [to, value, data, 0]);
		// let initCode = utils.hexConcat([this.ECDSAKernelFactory_Address, kernelAccountFactory.interface.encodeFunctionData("createAccount", [signerAddress, this.SMART_ACCOUNT_SALT])]);
		const gasPrice = await externalProvider.getGasPrice();

		// Check if the smart account contract has been deployed and setExecution has been called
		const smartWalletDeployed = await this.initSmartAccount(externalProvider, smartAccountAddress, signerAddress, options.chainId, options.apiKey);
		await this.checkExecutionSet(externalProvider, options);

		let nonce;
		if (!smartWalletDeployed) {
			nonce = 0;
		} else {
			nonce = await entryPoint.callStatic.getNonce(smartAccountAddress, 0);
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
		return userOperation;
	}

	async signUserOperation(externalProvider: JsonRpcProvider, userOperation: aaContracts.UserOperationStruct, options?: BastionSignerOptions): Promise<aaContracts.UserOperationStruct> {
		const { signer, entryPoint } = await this.initParams(externalProvider, options);

		const signature = await signer.signMessage(utils.arrayify(await entryPoint.getUserOpHash(userOperation)));
		const padding = "0x00000000";
		const signatureWithPadding = utils.hexConcat([padding, signature]);
		userOperation.signature = signatureWithPadding;

		return userOperation;
	}

	private async getSponsorship(apiKey: string, chainId: number, userOperation: aaContracts.UserOperationStruct, endpoint: string, erc20Token?: string): Promise<aaContracts.UserOperationStruct> {
		try {
			console.log("========== Calling Pimlico Paymaster to sponsor gas ==========");
			const payload = { chainId, userOperation };
			if (erc20Token) payload["erc20Token"] = erc20Token;
			const headers = {
				"x-api-key": apiKey,
			};
			const response = await axios.post(`${this.BASE_API_URL}${endpoint}`, payload, { headers });
			const updatedUserOperation = response?.data?.data?.paymasterDataResponse?.userOperation;

			return updatedUserOperation;
		} catch (e) {
			console.log("Error from getSponsorship api call: ", e.response.data);
			throw e;
		}
	}

	async getPaymasterSponsorship(chainId: number, userOperation: aaContracts.UserOperationStruct, apiKey: string): Promise<aaContracts.UserOperationStruct> {
		try {
			return await this.getSponsorship(apiKey, chainId, userOperation, "/v1/transaction/payment-sponsorship");
		} catch (error) {
			throw error;
		}
	}

	async getPaymasterSponsorshipERC20(chainId: number, userOperation: aaContracts.UserOperationStruct, erc20Token: string, apiKey: string): Promise<aaContracts.UserOperationStruct> {
		try {
			return await this.getSponsorship(apiKey, chainId, userOperation, "/v1/transaction/payment-sponsorship-erc20", erc20Token);
		} catch (error) {
			throw error;
		}
	}

	async sendTransaction(externalProvider: JsonRpcProvider, userOperation: aaContracts.UserOperationStruct, options?: BastionSignerOptions): Promise<SendTransactionResponse> {
		try {
			console.log("========== Sending transaction through bundler ==========");
			const headers = {
				"x-api-key": options.apiKey,
			};
			const response = await axios.post(
				`${this.BASE_API_URL}/v1/transaction/send-transaction`,
				{
					chainId: options.chainId,
					userOperation: userOperation,
				},
				{ headers }
			);
			const sendTransactionResponse = response?.data.data.sendTransactionResponse;
			return sendTransactionResponse;
		} catch (e) {
			console.log("Error from sendTransaction api call: ", e.response.data);
			throw e;
		}
	}

	async getTransactionReceiptByUserOpHash(userOpHash: string, chainId: number, apiKey: string): Promise<string> {
		try {
			const headers = {
				"x-api-key": apiKey,
			};
			const response = await axios.get(`${this.BASE_API_URL}/v1/transaction/receipt/${chainId}/${userOpHash}`, { headers });
			const trxReceipt = response?.data.data.trxReceipt.receipt.transactionHash;
			return trxReceipt;
		} catch (e) {
			console.log("Error from getTransactionReceiptByUserOpHash api call: ", e.message);
			return e.message;
		}
	}
}

