import * as aaContracts from "@account-abstraction/contracts";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet, utils, BigNumber } from "ethers";
import axios from "axios";
import { ECDSAKernelFactory__factory, Kernel__factory, BatchActions__factory } from "./contracts";
import { BastionSignerOptions } from "../bastionConnect";
import { mainnetIds } from "../../helper";
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
		let smartAccountAddress = await kernelAccountFactory.getAccountAddress(signerAddress, this.SALT);
		const contractCode = await externalProvider.getCode(smartAccountAddress);
		
		if (!options?.noSponsorship && (contractCode === "0x" || !contractCode)) {
			if(mainnetIds.includes(options.chainId)){
				return { signer, entryPoint, kernelAccountFactory, smartAccountAddress, signerAddress, exists: false };
			}
			await this.initSmartAccount(externalProvider, smartAccountAddress, signerAddress, options.chainId, options.apiKey);
		} else  if (contractCode === "0x" || !contractCode){
			return { signer, entryPoint, kernelAccountFactory, smartAccountAddress, signerAddress, exists: false };
		}
		return { signer, entryPoint, kernelAccountFactory, smartAccountAddress, signerAddress, exists: true };
	}

	async createSmartAccount(externalProvider: JsonRpcProvider, options?: BastionSignerOptions): Promise<string> {
		const { signer, kernelAccountFactory, smartAccountAddress, exists } = await this.initParams(externalProvider, options);

		// Return early if smartAccountAddress already exists.
		if (exists) {
			return smartAccountAddress;
		}

		const signerAddress = await signer.getAddress();
		const createTx = await kernelAccountFactory.createAccount(signerAddress, this.SALT, {gasLimit:300000});
		await createTx.wait(1);

		const smartAccount = await kernelAccountFactory.getAccountAddress(signerAddress, this.SALT);
		const kernel = await Kernel__factory.connect(smartAccount, signer);
		const executor = "0xaEA978bAa9357C7d2B3B2D243621B94ce3d5793F";
		const batchActions = await BatchActions__factory.connect(executor, signer);
		const executeBatchSelector = batchActions.interface.getSighash("executeBatch");
		const validator = "0x180D6465F921C7E0DEA0040107D342c87455fFF5";
		//Valid until the year 2030
		const validUntil = 1893456000;
		// Get the current block timestamp
		const validAfter = await externalProvider.getBlock("latest").then((block) => block.timestamp);
		const enableData = utils.defaultAbiCoder.encode(["address"], [signerAddress]);

		const setExecutionTx = await kernel.setExecution(executeBatchSelector, executor, validator, validUntil, validAfter, enableData);
		await setExecutionTx.wait();
		return kernelAccountFactory.getAccountAddress(signerAddress, this.SALT);
	}

	async createSmartAccountDapp(externalProvider: JsonRpcProvider, options?: BastionSignerOptions): Promise<string>{
		const { signerAddress, smartAccountAddress, exists } = await this.initParams(externalProvider, options);
		const headers = {
			"x-api-key": options.apiKey,
			'Accept': 'application/json',
      		'Content-Type': 'application/json'
		};
		// If the smart account has not been deployed, deploy it
		if (!exists) {
			try {
				const response = await fetch(
					`${this.BASE_API_URL}/v1/transaction/create-account`,
					{
						method: "POST",
						body: JSON.stringify(
							{
								chainId: options.chainId,
								eoa: signerAddress,
								salt: this.SALT,
							}
						),
						headers
					},
				);
				const res = await response.json();
				console.log(res);
				if(res.statusCode === "10001") throw new Error(res.message);
				return res.data.createAccountResponse.smartAccountAddress;
			} catch (error) {
				return error;
			}
		} else {
			return smartAccountAddress;
		}
	}


	async initSmartAccount(externalProvider: JsonRpcProvider, smartAccountAddress: string, signerAddress: string, chainId: number, apiKey: string): Promise<boolean> {
		const contractCode = await externalProvider.getCode(smartAccountAddress);
		const headers = {
			"x-api-key": apiKey,
			"Accept": "application/json",
			"Content-Type": "application/json",
		};
		// If the smart account has not been deployed, deploy it
		if (contractCode === "0x") {
			try {
				const response = await fetch(`${this.BASE_API_URL}/v1/transaction/create-account`, {
					method: "POST",
					body: JSON.stringify({ chainId: chainId, eoa: signerAddress, salt: this.SALT }),
					headers,
				});
				const res = await response.json();
				console.log("res",res);
				if(res.statusCode === "10001") throw new Error(res.message);
				return false;
			} catch (error) {
				return error;
			}
		} else {
			return true;
		}
	}

	async getGasEstimates(chainId: Number, userOp: aaContracts.UserOperationStruct, apiKey: string): Promise<any> {
		const headers = {
			"x-api-key": apiKey,
			"Accept": "application/json",
			"Content-Type": "application/json",
		};
		console.log("Inside getGasEstimates", userOp);
		try {
			const response = await fetch(`${this.BASE_API_URL}/v1/transaction/estimate-gas`, {
				method: "POST",
				body: JSON.stringify({ chainId: chainId, userOperation: userOp }),
				headers,
			});
			const res = await response.json();
			if(res.statusCode === "10001") throw new Error(res.message);
			console.log("Inside getGasEstimates", res);
			return res;
		} catch (error) {
			return error;
		}
	}

	async checkExecutionSet(externalProvider: JsonRpcProvider, options?: BastionSignerOptions) {
		const { smartAccountAddress, signer, exists } = await this.initParams(externalProvider, options);
		if(!exists) throw new Error("smart account doesn't exist, please create smart account first");

		const kernelAccount = await Kernel__factory.connect(smartAccountAddress, signer);

		const batchActionsInterface = new utils.Interface(["function executeBatch(address[] memory to, uint256[] memory value, bytes[] memory data, uint8 operation) external"]);
		const funcSignature = await batchActionsInterface.getSighash("executeBatch(address[],uint256[], bytes[], uint8)");

		// First get the execution details from kernerlAccount
		const executionDetails = await kernelAccount.getExecution(funcSignature);
		// Only set the execution if it hasn't been set already
		if (executionDetails[0] === 0) {
			// Valid until 31st Dec 2050
			const validUntil = 2524608000;

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

			let userOperation = await this.prepareTransaction(externalProvider, smartAccountAddress, 0, options, setExecutionCallData);
			if (!options?.noSponsorship) {
				const sponsoredUserOperation = await this.getPaymasterSponsorship(options.chainId, userOperation, options.apiKey);
				userOperation = sponsoredUserOperation; // Update userOperation with sponsored one
			}
			const signedUserOperation = await this.signUserOperation(externalProvider, userOperation, options);

			await this.sendTransaction(externalProvider, signedUserOperation, options);

			// Check execution details again for sanity
			const executionDetails = await kernelAccount.getExecution(funcSignature);
		}
	}

	async prepareTransaction(externalProvider: JsonRpcProvider, to: string, value: number, options?: BastionSignerOptions, data?: string): Promise<aaContracts.UserOperationStruct> {
		const { smartAccountAddress, entryPoint, signerAddress, signer, exists } = await this.initParams(externalProvider, options);
		if(!exists) throw new Error("smart account doesn't exist, please create smart account first");

		const kernelAccount = Kernel__factory.connect(smartAccountAddress, externalProvider);

		// 0 = call, 1 = delegatecall (type of Operation)
		const callData = kernelAccount.interface.encodeFunctionData("execute", [to, value, data, 0]);
		const gasPrice = await externalProvider.getGasPrice();

		// Check if the smart account contract has been deployed and setExecution has been called
		// const smartWalletDeployed = await this.initSmartAccount(externalProvider, smartAccountAddress, signerAddress, options.chainId, options.apiKey);

		// let nonce;
		// if (!smartWalletDeployed) {
		// 	nonce = 0;
		// } else {
		// 	nonce = await entryPoint.callStatic.getNonce(smartAccountAddress, 0);
		// }

		const nonce = await entryPoint.callStatic.getNonce(smartAccountAddress, 0);
		const dummySignature = "0x";

		const userOperation = {
			sender: smartAccountAddress,
			nonce: utils.hexlify(nonce),
			initCode: "0x",
			callData,
			callGasLimit: utils.hexlify(600_000),
			verificationGasLimit: utils.hexlify(600_000),
			preVerificationGas: utils.hexlify(200_000),
			maxFeePerGas: utils.hexlify(gasPrice),
			maxPriorityFeePerGas: utils.hexlify(gasPrice),
			paymasterAndData: "0x",
			signature: dummySignature,
		};
		// await this.getGasEstimates(options.chainId, userOperation, options.apiKey);
		return userOperation;
	}

	async prepareBatchTransaction(externalProvider: JsonRpcProvider, to: string[], data: string[], value: number[], options?: BastionSignerOptions): Promise<aaContracts.UserOperationStruct> {
		const { smartAccountAddress, entryPoint, signerAddress, exists } = await this.initParams(externalProvider, options);
		if(!exists) throw new Error("smart account doesn't exist, please create smart account first");

		const batchActions = BatchActions__factory.connect(smartAccountAddress, externalProvider);

		// 0 = call, 1 = delegatecall (type of Operation)
		const callData = batchActions.interface.encodeFunctionData("executeBatch", [to, value, data, 0]);
		// let initCode = utils.hexConcat([this.ECDSAKernelFactory_Address, kernelAccountFactory.interface.encodeFunctionData("createAccount", [signerAddress, this.SMART_ACCOUNT_SALT])]);
		const gasPrice = await externalProvider.getGasPrice();

		// // Check if the smart account contract has been deployed and setExecution has been called
		// const smartWalletDeployed = await this.initSmartAccount(externalProvider, smartAccountAddress, signerAddress, options.chainId, options.apiKey);
		// await this.checkExecutionSet(externalProvider, options);

		// let nonce;
		// if (!smartWalletDeployed) {
		// 	nonce = 0;
		// } else {
		// 	nonce = await entryPoint.callStatic.getNonce(smartAccountAddress, 0);
		// }

		await this.checkExecutionSet(externalProvider, options);
		const nonce = await entryPoint.callStatic.getNonce(smartAccountAddress, 0);

		const userOperation = {
			sender: smartAccountAddress,
			nonce: utils.hexlify(nonce),
			initCode: "0x",
			callData,
			callGasLimit: utils.hexlify(800_000),
			verificationGasLimit: utils.hexlify(800_000),
			preVerificationGas: utils.hexlify(800_000),
			maxFeePerGas: utils.hexlify(gasPrice),
			maxPriorityFeePerGas: utils.hexlify(gasPrice),
			paymasterAndData: "0x",
			signature: "0x",
		};
		return userOperation;
	}

	async signUserOperation(externalProvider: JsonRpcProvider, userOperation: aaContracts.UserOperationStruct, options?: BastionSignerOptions): Promise<aaContracts.UserOperationStruct> {
		const { signer, entryPoint, exists } = await this.initParams(externalProvider, options);
		if(!exists) throw new Error("smart account doesn't exist, please create smart account first");

		const signature = await signer.signMessage(utils.arrayify(await entryPoint.getUserOpHash(userOperation)));
		const padding = "0x00000000";
		const signatureWithPadding = utils.hexConcat([padding, signature]);
		userOperation.signature = signatureWithPadding;

		return userOperation;
	}

	private async getSponsorship(apiKey: string, chainId: number, userOperation: aaContracts.UserOperationStruct, endpoint: string, erc20Token?: string): Promise<aaContracts.UserOperationStruct> {
		try {
			const payload = { chainId, userOperation };
			if (erc20Token) payload["erc20Token"] = erc20Token;
			const headers = {
				"x-api-key": apiKey,
				"Accept": "application/json",
				"Content-Type": "application/json",
			};
			// const response = await axios.post(`${this.BASE_API_URL}${endpoint}`, payload, { headers });
			const response = await fetch(`${this.BASE_API_URL}${endpoint}`, {
				method: "POST",
				body: JSON.stringify(payload),
				headers,
			});
			const res = await response.json();
			if(res.statusCode === "10001") throw new Error(res.message);
			const updatedUserOperation = res?.data?.paymasterDataResponse?.userOperation;

			return updatedUserOperation;
		} catch (e) {
			throw new Error(`Error while getting sponsorship, reason: ${e.response.data.message}`);
		}
	}

	async getPaymasterSponsorship(chainId: number, userOperation: aaContracts.UserOperationStruct, apiKey: string): Promise<aaContracts.UserOperationStruct> {
		try {
			return await this.getSponsorship(apiKey, chainId, userOperation, "/v1/transaction/payment-sponsorship");
		} catch (error) {
			throw new Error(`PAYMENT_SPONSORSHIP_ERR~ Error while sending transaction through the bundler, reason: ${error.message}`);
		}
	}

	async getPaymasterSponsorshipERC20(chainId: number, userOperation: aaContracts.UserOperationStruct, erc20Token: string, apiKey: string): Promise<aaContracts.UserOperationStruct> {
		try {
			return await this.getSponsorship(apiKey, chainId, userOperation, "/v1/transaction/payment-sponsorship-erc20", erc20Token);
		} catch (error) {
			throw new Error(`PAYMENT_SPONSORSHIP_ERR_ERC20~ Error while sending transaction through the bundler, reason: ${error.message}`);
		}
	}

	async sendTransaction(externalProvider: JsonRpcProvider, userOperation: aaContracts.UserOperationStruct, options?: BastionSignerOptions): Promise<SendTransactionResponse> {
		try {
			const headers = {
				"x-api-key": options.apiKey,
				"Accept": "application/json",
				"Content-Type": "application/json",
			};
			// const response = await axios.post(
			// 	`${this.BASE_API_URL}/v1/transaction/send-transaction`,
			// 	{
			// 		chainId: options.chainId,
			// 		userOperation: userOperation,
			// 	},
			// 	{ headers }
			// );
			const response = await fetch(`${this.BASE_API_URL}/v1/transaction/send-transaction`, {
				method: "POST",
				body: JSON.stringify({
					chainId: options.chainId,
					userOperation: userOperation,
				}),
				headers,
			});
			const res = await response.json();
			if(res.statusCode === "10001") throw new Error(res.message);
			const sendTransactionResponse = res?.data.sendTransactionResponse;
			return sendTransactionResponse;
		} catch (e) {
			throw new Error(`Error while sending transaction through the bundler, reason: ${e.message}`);
		}
	}

	async getTransactionReceiptByUserOpHash(userOpHash: string, chainId: number, apiKey: string): Promise<string> {
		try {
			const headers = {
				"x-api-key": apiKey,
				"Accept": "application/json",
				"Content-Type": "application/json",
			};
			// const response = await axios.get(`${this.BASE_API_URL}/v1/transaction/receipt/${chainId}/${userOpHash}`, { headers });
			const response = await fetch(`${this.BASE_API_URL}/v1/transaction/receipt/${chainId}/${userOpHash}`, {
				method: "GET",
				headers,
			});
			const res = await response.json();
			if(res.statusCode === "10001") throw new Error(res.message);
			const trxReceipt = res?.data.trxReceipt.receipt.transactionHash;
			return trxReceipt;
		} catch (e) {
			throw new Error(`Error while getting transaction receipt by user operation hash, reason : ${e.message}`);
		}
	}
}

