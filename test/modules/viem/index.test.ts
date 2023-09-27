import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { SmartWallet } from "../../../src/modules/smart-wallet";
import { Bastion } from "../../../src/index";
import { describe, beforeEach, it, expect } from "@jest/globals";
import { skip } from "node:test";
import { ERC721_ABI } from "../../utils/ERC721_ABI";
import {polygonMumbai, arbitrumGoerli} from 'viem/chains'
import { BastionSignerOptions } from '../../../src/modules/bastionConnect';
import { ethers } from 'ethers';
import {abi} from "./ERC721ABI"  ;
 
let smartWallet: SmartWallet;
let client, publicClient;
let provider;
let BastionSampleNFT = "0xb390e253e43171a11a6afcb04e340fde5ae1b0a1";
let account;

const DEFAULT_CONFIG: BastionSignerOptions = {
	privateKey: process.env.PRIVATE_KEY || "",
	// rpcUrl: process.env.RPC_URL1 || "", //mumbai
	// chainId: 80001,
	rpcUrl: process.env.RPC_URL_ARB_GOERLI || "", // arb-goerli
	chainId: 421613,
	// rpcUrl: process.env.RPC_URL3 || "", // scroll
	// chainId: 534353,
	// rpcUrl: process.env.RPC_URL4 || "", // linea
	// chainId: 59140,
	// rpcUrl: process.env.RPC_URL5 || "", // base-goerli
	// chainId: 84531,
	// rpcUrl: process.env.RPC_URL6 || "", // optimism-goerli
	// chainId: 420,
	apiKey: process.env.BASTION_API_KEY || "",
};
const setup = () => {
    account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);
    const client = createWalletClient({account,
         chain: arbitrumGoerli, 
        transport : http(DEFAULT_CONFIG.rpcUrl)})

	publicClient = createPublicClient({
		chain: arbitrumGoerli,
		transport : http(DEFAULT_CONFIG.rpcUrl),
	  });
	  console.log(client, publicClient )
	return client;

};	


describe("setupSmartAccount", ()=> {
    beforeEach(() => {
		provider = new ethers.providers.JsonRpcProvider(DEFAULT_CONFIG.rpcUrl);
		client = setup();
	});

	it.skip("should test viem", async () => {
		let bastion = new Bastion();
		const BastionViem = await bastion.viemConnect;

		const aaAddress = await BastionViem.init(client, DEFAULT_CONFIG);
		const retaddr = await BastionViem.getAddress();
		console.log("aa", aaAddress, retaddr)
		const signature = await BastionViem.signMessage("hello world");
		// const signature = await BastionViem.signMessage("hello world", account);

		console.log("signature", signature);
	}, 70000);


    it("should call a Smart Contract function gasless for ERC20 gas", async () => {
		let bastion = new Bastion();
		const BastionViem = await bastion.viemConnect;

		//Pass along a gasToken to use for gas
		const aaAddress = await BastionViem.init(client, DEFAULT_CONFIG);

		// const contractAddress = "0xEAC57C1413A2308cd03eF3CEa5c9224487825341";

		// const { request } = await publicClient.simulateContract({
		// 	account,
		// 	address: contractAddress,
		// 	abi: abi,
		// 	functionName: 'safeMint',
		// 	args: [aaAddress]
		//   })
		// console.log("req", request);
		  
		// await BastionViem.writeContract(client,request);
		// const res = true
	}, 70000);


})

