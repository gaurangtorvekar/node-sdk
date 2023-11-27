import * as aaContracts from "@account-abstraction/contracts";
import { WalletClient, PublicClient, getContract, encodeFunctionData, getFunctionSelector, Chain } from "viem";
import { arbitrumGoerli } from "viem/chains";
import { Wallet, utils, BigNumber } from "ethers";
import axios from "axios";
import { ECDSAKernelFactory__factory, Kernel__factory, BatchActions__factory } from "./contracts";
import { BastionSignerOptions } from "../bastionConnect";
import { UserOperationStructViem } from "../viemConnect/type";
import { getViemChain, mainnetIds } from "../../helper";

export interface SendTransactionResponse {
	bundler: string;
	bundlerURL: string;
	chainId: number;
	userOperationHash: string;
}

export class SmartWalletViem {
	ECDSAKernelFactory_Address: `0x${string}` = "0xf7d5E0c8bDC24807c8793507a2aF586514f4c46e";
	ENTRY_POINT_ADDRESS: `0x${string}` = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
	BATCH_ACTIONS_EXECUTOR: `0x${string}` = "0xaEA978bAa9357C7d2B3B2D243621B94ce3d5793F";
	VALIDATOR_ADDRESS: `0x${string}` = "0x180D6465F921C7E0DEA0040107D342c87455fFF5";
	BASE_API_URL = "https://api.bastionwallet.io";
	SALT = 0;

	walletClient:WalletClient;
	publicClient:PublicClient;
	chain: Chain;

	async initParams(walletClient: WalletClient, publicClient: PublicClient,  options?: BastionSignerOptions) {
		this.walletClient = walletClient;
		this.publicClient = publicClient;
		this.chain = await getViemChain(options.chainId);

        const entryPoint = getContract({
			address: this.ENTRY_POINT_ADDRESS as `0x${string}`,
			abi: aaContracts.EntryPoint__factory.abi,
			publicClient,
			walletClient
		})
		const kernelAccountFactory = getContract({
			address: this.ECDSAKernelFactory_Address as `0x${string}`,
			abi: ECDSAKernelFactory__factory.abi,
			publicClient,
			walletClient
		})
		const clientAddress = walletClient.account.address;
		let smartAccountAddress: `0x${string}` = await kernelAccountFactory.read.getAccountAddress([clientAddress, BigInt(this.SALT)])
		const contractCode = await this.publicClient.getBytecode({address: smartAccountAddress});

		if (!options?.noSponsorship && (contractCode === "0x" || !contractCode)) {
			if(mainnetIds.includes(options.chainId)){
				return { clientAddress, kernelAccountFactory, smartAccountAddress, exists: false};
			}
			await this.initSmartAccount(smartAccountAddress, clientAddress, options.chainId, options.apiKey);
		} else if (contractCode === "0x" || !contractCode) {
			return { walletClient, publicClient, entryPoint, kernelAccountFactory, smartAccountAddress, clientAddress, exists: false };
		}
		return { walletClient, publicClient, entryPoint, kernelAccountFactory, smartAccountAddress, clientAddress, exists: true };
	}

	async initSmartAccount(smartAccountAddress: `0x${string}`, clientAddress: string, chainId: number, apiKey: string): Promise<boolean> {
		const contractCode = await this.publicClient.getBytecode({address: smartAccountAddress});
		const headers = {
			"x-api-key": apiKey,
			'Accept': 'application/json',
      		'Content-Type': 'application/json'
		};
		// If the smart account has not been deployed, deploy it
		if (contractCode === "0x" || contractCode == undefined) {
			try {

				const response = await fetch(
					`${this.BASE_API_URL}/v1/transaction/create-account`,
					{
						method: "POST",
						body: JSON.stringify(
							{
								chainId: chainId,
								eoa: clientAddress,
								salt: this.SALT,
							}
						),
						headers
					},
				);
				const res = await response.json();
				console.log(res);
				if(res.statusCode === "10001") throw new Error(res.message);
				return false;
			} catch (error) {
				return error;
			}
		} else {
			return true;
		}
	}

	async checkExecutionSet(publicClient: PublicClient, walletClient: WalletClient, options?: BastionSignerOptions) {
		const { smartAccountAddress, exists } = await this.initParams(walletClient, publicClient, options);
		if(!exists) throw new Error("smart account doesn't exist, please create smart account first");
		const kernelAccount = getContract({
			address: smartAccountAddress,
			abi: Kernel__factory.abi,
			publicClient,
			walletClient
		})
		const batchActionsInterface = new utils.Interface(["function executeBatch(address[] memory to, uint256[] memory value, bytes[] memory data, uint8 operation) external"]);
		const funcSignature = (batchActionsInterface.getSighash("executeBatch(address[],uint256[], bytes[], uint8)")) as `0x${string}`;

		// First get the execution details from kernerlAccount
		const executionDetails = await kernelAccount.read.getExecution([funcSignature]);
		// Only set the execution if it hasn't been set already
		if (executionDetails[0] === 0) {
			// Valid until 2030
			const validUntil = 1893456000;

			// Valid after current block timestamp
			const block = await publicClient.getBlock();
			const timestamp = block.timestamp;
			const validAfter = timestamp;

			// Encode packed owner address
			const owner = walletClient.account.address;
			const ownerSliced = owner.slice(2).padStart(40, "0");
			const packedData = utils.arrayify("0x" + ownerSliced);

			const setExecutionCallData = encodeFunctionData({
				abi: kernelAccount.abi,
				functionName: "setExecution",
				args: [
					funcSignature,
					this.BATCH_ACTIONS_EXECUTOR,
					this.VALIDATOR_ADDRESS,
					validUntil,
					validAfter,
					//@ts-ignore
					packedData,
				]
			})

			const userOperation = await this.prepareTransaction(publicClient, walletClient, smartAccountAddress, 0, options, setExecutionCallData);
			const sponsoredUserOperation = await this.getPaymasterSponsorship(options.chainId, userOperation, options.apiKey) as UserOperationStructViem;
			const signedUserOperation = await this.signUserOperation(publicClient, walletClient, sponsoredUserOperation, options) as UserOperationStructViem;
			await this.sendTransaction( signedUserOperation, options);

			// Check execution details again for sanity
			const executionDetails = await kernelAccount.read.getExecution([funcSignature]);
		}
	}

	async prepareTransaction(publicClient: PublicClient, walletClient: WalletClient, to: `0x${string}`, value: number, options?: BastionSignerOptions, data?: `0x${string}`): Promise<aaContracts.UserOperationStruct> {
		const { smartAccountAddress, entryPoint, clientAddress, exists } = await this.initParams(walletClient, publicClient, options);
		if(!exists) throw new Error("smart account doesn't exist, please create smart account first");
		
		const kernelAccount = getContract({
			address: smartAccountAddress,
			abi: Kernel__factory.abi,
			publicClient,
			walletClient
		})

		// 0 = call, 1 = delegatecall (type of Operation)
		const callData = encodeFunctionData({
			abi: kernelAccount.abi,
			functionName: "execute",
			args: [
				to, BigInt(value), data, 0
			]
		})
		
		const gasPrice = await publicClient.getGasPrice() 

		// Check if the smart account contract has been deployed and setExecution has been called
		const smartWalletDeployed = await this.initSmartAccount(smartAccountAddress, clientAddress, options.chainId, options.apiKey);

		let nonce;
		if (!smartWalletDeployed) {
			nonce = 0;
		} else {
			nonce = await entryPoint.read.getNonce([smartAccountAddress, BigInt(0)]);
		}		
		const dummySignature = utils.hexConcat([
			"0x00000000",
			await walletClient.signMessage({
				account: walletClient.account,
				message: {raw: utils.keccak256("0xdead") as `0x${string}`}
			}),
		])

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
			signature: dummySignature, 
		};
		return userOperation;
	}

	async prepareBatchTransaction(publicClient: PublicClient, walletClient: WalletClient, to: `0x${string}`[], data: `0x${string}`[], value:readonly bigint[], options?: BastionSignerOptions): Promise<aaContracts.UserOperationStruct> {
		const { smartAccountAddress, entryPoint, clientAddress, exists } = await this.initParams(walletClient, publicClient, options);
		if(!exists) throw new Error("smart account doesn't exist, please create smart account first");
		
		const batchActions = getContract({
			address: smartAccountAddress,
			abi: BatchActions__factory.abi,
			publicClient,
			walletClient
		})

		// 0 = call, 1 = delegatecall (type of Operation)
		const callData = encodeFunctionData({
			abi: batchActions.abi,
			functionName: "executeBatch",
			args: [to, value, data, 0]
		})
		const gasPrice = await publicClient.getGasPrice();

		// Check if the smart account contract has been deployed and setExecution has been called
		const smartWalletDeployed = await this.initSmartAccount(smartAccountAddress, clientAddress, options.chainId, options.apiKey);
		await this.checkExecutionSet(publicClient, walletClient, options);

		let nonce;
		if (!smartWalletDeployed) {
			nonce = 0;
		} else {
			nonce = await entryPoint.read.getNonce([smartAccountAddress, BigInt(0)]);
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

	async signUserOperation(publicClient: PublicClient, walletClient: WalletClient, userOperation: UserOperationStructViem, options?: BastionSignerOptions): Promise<aaContracts.UserOperationStruct> {
		const { entryPoint, clientAddress,exists } = await this.initParams(walletClient, publicClient, options);
		if(!exists) throw new Error("smart account doesn't exist, please create smart account first");
		const signature = await walletClient.signMessage({
			account: walletClient.account,
			message: { raw: await entryPoint.read.getUserOpHash([userOperation])}
		});
		const padding = "0x00000000";
		const signatureWithPadding = utils.hexConcat([padding, signature]);
		userOperation.signature = signatureWithPadding as `0x${string}`;

		return userOperation;
	}

	private async getSponsorship(apiKey: string, chainId: number, userOperation: aaContracts.UserOperationStruct, endpoint: string, erc20Token?: string): Promise<aaContracts.UserOperationStruct> {
		try {
			const payload = { chainId, userOperation };
			if (erc20Token) payload["erc20Token"] = erc20Token;
			const headers = {
				"x-api-key": apiKey,
				'Accept': 'application/json',
      			'Content-Type': 'application/json'
			};
			// const response = await axios.post(`${this.BASE_API_URL}${endpoint}`, payload, { headers });
			const response = await fetch(`${this.BASE_API_URL}${endpoint}`, {
				method: "POST",
				body: JSON.stringify(payload),
				headers
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
			throw new Error(`PAYMENT_SPONSORSHIP_ERR~ Error while sending transaction through the bundler, reason: ${error.message}`);
		}
	}

	async sendTransaction(userOperation: UserOperationStructViem, options?: BastionSignerOptions): Promise<SendTransactionResponse> {
		const { exists } = await this.initParams(this.walletClient, this.publicClient, options);
		if(!exists) throw new Error("smart account doesn't exist, please create smart account first");
		try {
			const headers = {
				"x-api-key": options.apiKey,
				'Accept': 'application/json',
      			'Content-Type': 'application/json'
			};
			// const response = await axios.post(
			// 	`${this.BASE_API_URL}/v1/transaction/send-transaction`,
			// 	{
			// 		chainId: options.chainId,
			// 		userOperation: userOperation,
			// 	},
			// 	{ headers }
			// );
			// const sendTransactionResponse = response?.data.data.sendTransactionResponse;
			const response = await fetch(
				`${this.BASE_API_URL}/v1/transaction/send-transaction`,{
					method: "POST",
					body: JSON.stringify({
						chainId: options.chainId,
						userOperation: userOperation,
					}),
					headers 
				}
			);

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
				'Accept': 'application/json',
      			'Content-Type': 'application/json'
			};
			// const response = await axios.get(`${this.BASE_API_URL}/v1/transaction/receipt/${chainId}/${userOpHash}`, { headers });
			const response = await fetch(`${this.BASE_API_URL}/v1/transaction/receipt/${chainId}/${userOpHash}`, { 
				method: "GET",
				headers 
			});
			const res = await response.json();
			if(res.statusCode === "10001") throw new Error(res.message);
			const trxReceipt = res?.data.trxReceipt.receipt.transactionHash;
			return trxReceipt;
		} catch (e) {
			throw new Error(`Error while getting transaction receipt by user operation hash, reason: ${e.message}`);
		}
	}

	async createSmartAccountDapp(options?: BastionSignerOptions): Promise<string>{
		let { clientAddress, exists, smartAccountAddress } = await this.initParams(this.walletClient, this.publicClient, options);
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
								eoa: clientAddress,
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

	async createSmartAccount(options?: BastionSignerOptions): Promise<string> {
		let { clientAddress, kernelAccountFactory, smartAccountAddress,exists } = await this.initParams(this.walletClient, this.publicClient, options);
		// Return early if smartAccountAddress already exists.
		const balance = await this.publicClient.getBalance({ 
			address: clientAddress,
		  })
		if(balance.toString() === "0") throw new Error("insufficient funds in EOA to create account");
		if (exists) {
			return smartAccountAddress;
		}
		
		const signerAddress: `0x${string}` = clientAddress;
		const createTx = await this.walletClient.writeContract({
			address: this.ECDSAKernelFactory_Address as `0x${string}`,
			abi: ECDSAKernelFactory__factory.abi,
			functionName: "createAccount",
			args: [signerAddress, BigInt(this.SALT)],
			account: this.walletClient.account,
			chain: this.chain
		})
		smartAccountAddress= await kernelAccountFactory.read.getAccountAddress([clientAddress, BigInt(this.SALT)]);

		const executor = "0xaEA978bAa9357C7d2B3B2D243621B94ce3d5793F";
		const executeBatchSelector = getFunctionSelector("executeBatch(address[] to, uint256[] value, bytes[] data, Operation operation)");
		const validator = "0x180D6465F921C7E0DEA0040107D342c87455fFF5";
		//Valid until the year 2030
		const validUntil = 1893456000;
		// Get the current block timestamp
		const validAfter = await this.publicClient.getBlock().then((block) => block.timestamp);
		const enableData = utils.defaultAbiCoder.encode(["address"], [signerAddress]) as `0x${string}`;


		const setExecutionTrx = await this.walletClient.writeContract({
			address: smartAccountAddress,
			abi: Kernel__factory.abi,
			functionName: "setExecution",
			args:[executeBatchSelector, executor, validator, validUntil, validAfter, enableData],
			chain: this.chain,
			account: this.walletClient.account,
		}) 

		return smartAccountAddress
	}
}

