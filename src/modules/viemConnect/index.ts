import axios from "axios";
import { SmartWallet } from "../smart-wallet";
import type {Abi,  Account, Client, PublicClient, WalletClient, Transport, Chain, EncodeFunctionDataParameters, Hex, ByteArray} from "viem"
import {encodeFunctionData, createPublicClient, http, createWalletClient, getAddress} from 'viem';
import {WriteContractReturnType, WriteContractParameters} from './type'
import { checkChainCompatibility } from "../../helper";
import { ethers } from "ethers";
import { transactionRouting } from "../../helpers/viemHelper";
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

		const response = await axios.get(`${this.BASE_API_URL}/v1/auth/validate-key/${apiKey}`);
		if (!response.data.data.isValid) {
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

		const {  smartAccountAddress } = await this.smartWalletInstance.initParams(walletClient, publicClient, this.options);
        return smartAccountAddress;        
    }

    async getAddress(): Promise<string> {
		const { smartAccountAddress } = await this.smartWalletInstance.initParams(this.walletClient, this.publicClient, this.options);
		return smartAccountAddress;
	}

    async signMessage(message: string | { raw: Hex | ByteArray }, account?: Account, ): Promise<string> {
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
        console.log("transaciton", transaction); 
        const a = await transactionRouting(this.publicClient, this.walletClient, transaction, this.options);
        console.log("a",a)
        // Write the transaction routing logic
        const hash = '0xyz';
        
        return hash
    }

}