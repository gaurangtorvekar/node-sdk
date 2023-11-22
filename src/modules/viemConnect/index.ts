import axios from "axios";
import {Abi,  Account, PublicClient, WalletClient, Chain, 
    EncodeFunctionDataParameters, Hex, ByteArray, Address} from "viem"
import {encodeFunctionData} from 'viem';
import {WriteContractReturnType, WriteContractParameters, Hash} from './type'
import { checkChainCompatibility } from "../../helper";
import { transactionRouting, batchTransactionRouting } from "../../helpers/viemHelper";
import { SmartWalletViem } from "../smart-wallet/viemSmartWallet";
export interface BastionViemOptions {
	privateKey?: string;
	rpcUrl?: string;
	chainId?: number;
    chain?: Chain;
	apiKey: string;
	gasToken?: string;
	noSponsorship?: boolean;
}

export class ViemConnect {

    private BASE_API_URL = "https://api.bastionwallet.io";
	private smartWalletInstance: SmartWalletViem;
    private options: BastionViemOptions;
    private publicClient : PublicClient;
    private walletClient : WalletClient;

    private async validateApiKey(apiKey?: string): Promise<void> {
		if (!apiKey) {
			throw new Error("API Key is required");
		}

        const response = await fetch(`${this.BASE_API_URL}/v1/auth/validate-key/${apiKey}`);
		const res = await response.json();
		if (!res.data.isValid) {
			throw new Error("Invalid API Key");
		}
	}

    async init(publicClient: PublicClient, walletClient: WalletClient, options?: BastionViemOptions) {
		await this.validateApiKey(options?.apiKey);
		const chainId = options?.chainId ;
		await checkChainCompatibility(chainId);
		
        this.publicClient = publicClient;
        this.walletClient = walletClient;
        this.smartWalletInstance = new SmartWalletViem();
		this.options = { ...options, chainId };

		const {  smartAccountAddress, exists } = await this.smartWalletInstance.initParams(walletClient, publicClient, this.options);
        return {smartAccountAddress, exists};        
    }

    async getAddress(){
		const { smartAccountAddress, exists } = await this.smartWalletInstance.initParams(this.walletClient, this.publicClient, this.options);
		return {smartAccountAddress, exists};
	}

    async signMessage(message: string | { raw: Hex | ByteArray }, account?: Account, ): Promise<Hex> {
		return this.walletClient.signMessage({account, message});
	}

    async writeContract<
        TChain extends Chain | undefined,
        TAccount extends Account | undefined,
        const TAbi extends Abi | readonly unknown[],
        TFunctionName extends string,
        TChainOverride extends Chain | undefined,
    >(
        {
            abi,
            address,
            args,
            dataSuffix,
            functionName,
            ...request
        }: WriteContractParameters<
            TAbi,
            TFunctionName,
            TChain,
            TAccount,
            TChainOverride
        >,
    ): Promise<WriteContractReturnType> {
        const data = encodeFunctionData({
            abi,
            args,
            functionName,
        } as unknown as EncodeFunctionDataParameters<TAbi, TFunctionName>)

        const transaction = {
            data: `${data}${dataSuffix ? dataSuffix.replace('0x', '') : ''}`,
            to: address,
            ...request
          }
        try {
            const res = await transactionRouting(this.publicClient, this.walletClient, transaction, this.options);
            return res?.hash as `0x${string}` ;
        } catch (error) {
            return error
        }
    }

    async writeContractBatch<
        TChain extends Chain | undefined,
        TAccount extends Account | undefined,
        const TAbi extends Abi | readonly unknown[],
        TFunctionName extends string,
        TChainOverride extends Chain | undefined,
    >(
        batchInputs: Array<WriteContractParameters<
            TAbi,
            TFunctionName,
            TChain,
            TAccount,
            TChainOverride
        >>,
    ): Promise<WriteContractReturnType> {
        const transactions = [];
        try {
            for (const parameterSet of batchInputs) {
                const { abi, address, args, dataSuffix, functionName, ...request } = parameterSet;
                const data = encodeFunctionData({
                    abi,
                    args,
                    functionName,
                } as unknown as EncodeFunctionDataParameters<TAbi, TFunctionName>)
        
                const transaction = {
                    data: `${data}${dataSuffix ? dataSuffix.replace('0x', '') : ''}`,
                    to: address,
                    ...request
                }
                if(!transaction.value) {
                    //@ts-ignore
                    transaction.value = BigInt(0);
                }
                transactions.push(transaction);
            }
            const res = await batchTransactionRouting(this.publicClient, this.walletClient, transactions, this.options);
            return res?.hash as `0x${string}` ;
        } catch (error) {
            return error
        }
    }

    async sendTransaction(address : Address, value: Number): Promise<Hash> {
        const transaction : any = {
            to: address,
            value
          }
        
        const res = await transactionRouting(this.publicClient, this.walletClient, transaction, this.options);
        return res?.hash as `0x${string}` ;
    }

    async createSmartAccount(): Promise<string> {
		return this.smartWalletInstance.createSmartAccount(this.options);
	}

    async createSmartAccountByDapp(): Promise<string> {
		return this.smartWalletInstance.createSmartAccountDapp(this.options);
	}
    
}