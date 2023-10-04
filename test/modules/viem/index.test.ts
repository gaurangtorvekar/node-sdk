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
let client, publicClient, walletClient;
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
const setup = async() => {
    account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);
    walletClient = createWalletClient({
		 account,
         chain: arbitrumGoerli, 
        transport : http(DEFAULT_CONFIG.rpcUrl)
	})
	publicClient = createPublicClient({
		chain: arbitrumGoerli,
		transport : http(DEFAULT_CONFIG.rpcUrl),
	  });
	return publicClient;
};	


describe("setupSmartAccount", ()=> {
    beforeEach(() => {
		provider = new ethers.providers.JsonRpcProvider(DEFAULT_CONFIG.rpcUrl);
		client = setup();
	});

	it.skip("should get a samrt wallet address and message signature", async () => {
		let bastion = new Bastion();
		const BastionViem = await bastion.viemConnect;

		const aaAddress = await BastionViem.init(publicClient, walletClient, DEFAULT_CONFIG);
		const retaddr = await BastionViem.getAddress();
		expect(aaAddress).toEqual(retaddr)

		//by passing only msg
		const signature = await BastionViem.signMessage("hello world");
		expect(signature).toEqual("0x51af0110abe4ca72cdf03be9c88cc57bd261f2f68795f88efba6dd932beed61e52e96053ec73b2877ec61c1bac107d66ac3d5001f0cd2d3f3c9000c31b91e7731c");
		//by passing account and msg
		const signatureByAcc = await BastionViem.signMessage("hello world", account);
		expect(signatureByAcc).toEqual("0x51af0110abe4ca72cdf03be9c88cc57bd261f2f68795f88efba6dd932beed61e52e96053ec73b2877ec61c1bac107d66ac3d5001f0cd2d3f3c9000c31b91e7731c");

	}, 70000);


    it("should mint a NFT gaslessly with simulateContract methods", async () => {
		let bastion = new Bastion();
		const BastionViem = await bastion.viemConnect;
		//Pass along a gasToken to use for gas
		const aaAddress = await BastionViem.init(publicClient,walletClient, DEFAULT_CONFIG);

		const contractAddress = "0xEAC57C1413A2308cd03eF3CEa5c9224487825341";

		const { request } = await publicClient.simulateContract({
			account,
			address: contractAddress,
			abi: abi,
			functionName: 'safeMint',
			args: [aaAddress]
		})

		const trxhash = await BastionViem.writeContract(request);
		console.log("Trx hash:", trxhash);
		expect(trxhash).toHaveLength(66);

	}, 70000);

	it.skip("should mint a NFT gaslessly by calling standalone writeContract method", async () => {
		let bastion = new Bastion();
		const BastionViem = await bastion.viemConnect;
		//Pass along a gasToken to use for gas
		const aaAddress = await BastionViem.init(publicClient,walletClient, DEFAULT_CONFIG);

		const contractAddress = "0xEAC57C1413A2308cd03eF3CEa5c9224487825341";

		const trxhash = await BastionViem.writeContract({
			account,
			address: contractAddress,
			abi: abi,
			functionName: 'safeMint',
			args: [aaAddress],
			chain: arbitrumGoerli
		});
		console.log("Trx hash:", trxhash);
		expect(trxhash).toHaveLength(66);
	}, 70000);


})

