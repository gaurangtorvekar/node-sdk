import axios from "axios";
import { SmartWallet } from "../smart-wallet";
import type {Abi,  Account, Client, Transport, Chain, EncodeFunctionDataParameters} from "viem"
import {encodeFunctionData, createPublicClient, http, createWalletClient, getAddress} from 'viem';
import { privateKeyToAccount } from 'viem/accounts'
import {WriteContractReturnType, WriteContractParameters} from './type'
import {polygonMumbai} from 'viem/chains'
import { checkChainCompatibility } from "../../helper";
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
	private smartWalletInstance: SmartWallet;
    private options: BastionViemOptions;
    private client : any;
    

    private async validateApiKey(apiKey?: string): Promise<void> {
		if (!apiKey) {
			throw new Error("API Key is required");
		}

		const response = await axios.get(`${this.BASE_API_URL}/v1/auth/validate-key/${apiKey}`);
		if (!response.data.data.isValid) {
			throw new Error("Invalid API Key");
		}
	}


    async init(options?: BastionViemOptions) {
		await this.validateApiKey(options?.apiKey);

		const chainId = options?.chainId ;
		await checkChainCompatibility(chainId);
		
		this.options = { ...options, chainId };
        const account = privateKeyToAccount(`0x${options?.privateKey}`);
        this.client =  await createWalletClient({account,
            chain: options?.chain || polygonMumbai, 
           transport : http(options?.rpcUrl)})
        
    }



    async writeContract<
        TChain extends Chain | undefined,
        TAccount extends Account | undefined,
        const TAbi extends Abi | readonly unknown[],
        TFunctionName extends string,
        TChainOverride extends Chain | undefined,
    >(
        client: Client<Transport, TChain, TAccount>,
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

        // Write the transaction routing logic
        const hash = '0xyz';
        
        return hash
    }

    async getAddress(address: string) {
        return getAddress(address)
    }
}