import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { SmartWallet } from "../../../src/modules/smart-wallet";
import { Bastion } from "../../../src/index";
import { describe, beforeEach, it, expect } from "@jest/globals";
import { skip } from "node:test";
import { ERC721_ABI } from "../../utils/ERC721_ABI";
import {polygonMumbai, arbitrumGoerli,scrollTestnet, lineaTestnet, baseGoerli, optimismGoerli, base, sepolia} from 'viem/chains'
import { BastionSignerOptions } from '../../../src/modules/bastionConnect';
import { ethers } from 'ethers';
import {abi} from "./ERC721ABI"  ;
 
let smartWallet: SmartWallet;
let client, publicClient, walletClient;
let BastionSampleNFT = "0xb390e253e43171a11a6afcb04e340fde5ae1b0a1";
let account;

const DEFAULT_CONFIG: BastionSignerOptions = {
	privateKey: process.env.PRIVATE_KEY || "",
	// rpcUrl: process.env.RPC_URL1 || "", //mumbai
	// chainId: 80001,
	// rpcUrl: process.env.RPC_URL2 || "", // arb-goerli
	// chainId: 421613,
	// rpcUrl: process.env.RPC_URL3 || "", // scroll
	// chainId: 534353,
	// rpcUrl: process.env.RPC_URL4 || "", // linea
	// chainId: 59140,
	// rpcUrl: process.env.RPC_URL_BASE_GOERLI || "", // base-goerli
	// chainId: 84531,
	// rpcUrl: process.env.RPC_URL_BASE || "", // base
	// chainId: 8453,
	// rpcUrl: process.env.RPC_URL6 || "", // optimism-goerli
	// chainId: 420,
	rpcUrl: process.env.RPC_URL_SEPOLIA || "", // sepolia
	chainId: 11155111,
	apiKey: process.env.BASTION_API_KEY || "",
};

const getViemChain = (chainId) => {
	switch(chainId){
		case 80001:
			return polygonMumbai;
		case 421613:
			return arbitrumGoerli;
		case 534353:
			return scrollTestnet;
		case 59140:
			return lineaTestnet;
		case 84531:
			return baseGoerli;
		case 420:
			return optimismGoerli;
		case 8453:
			return base;
		case 11155111:
			return sepolia;
	}
}

const setup = async() => {
    account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);
    walletClient = createWalletClient({
		 account,
         chain: getViemChain(DEFAULT_CONFIG.chainId), 
        transport : http(DEFAULT_CONFIG.rpcUrl)
	})
	publicClient = createPublicClient({
		chain: getViemChain(DEFAULT_CONFIG.chainId),
		transport : http(DEFAULT_CONFIG.rpcUrl),
	  });
	return publicClient;
};	

describe("setupSmartAccount", ()=> {
    beforeEach(() => {
		client = setup();
	});

	it.skip("should call a Smart Contract function gasless for ERC20 gas", async () => {
		let bastion = new Bastion();
		const BastionViem = await bastion.viemConnect;

		//Pass along a gasToken to use for gas
		DEFAULT_CONFIG.gasToken = "DAI";
		const { smartAccountAddress: aaAddress }  = await BastionViem.init(publicClient, walletClient, DEFAULT_CONFIG);

		const contractAddress = "0xEAC57C1413A2308cd03eF3CEa5c9224487825341";
		const contractABI = ["function safeMint(address to) public", "function balanceOf(address owner) external view returns (uint256 balance)"];

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

	it.skip("should send native currency to another address gasless", async () => {
		let bastion = new Bastion();
		const BastionViem = await bastion.viemConnect;
		const { smartAccountAddress: aaAddress }  = await BastionViem.init(publicClient, walletClient, DEFAULT_CONFIG);

		console.log("My address = ", aaAddress);

		const res = await BastionViem.sendTransaction(
			"0x2429EB38cB9b456160937e11aefc80879a2d2712",
			10
		);
		console.log("Trx hash:", res);
		expect(res).toHaveLength(66);
	}, 50000);

	it.skip("should get a smart wallet address and message signature", async () => {
		let bastion = new Bastion();
		// DEFAULT_CONFIG.noSponsorship = true;
		const BastionViem = await bastion.viemConnect;

		let {smartAccountAddress: aaAddress} = await BastionViem.init(publicClient, walletClient, DEFAULT_CONFIG);
		console.log(aaAddress)
		// if(aaAddress === "0x") aaAddress = (await BastionViem.createSmartAccount()) as `0x${string}`;
		if(aaAddress === "0x") aaAddress = (await BastionViem.createSmartAccountByDapp()) as `0x${string}`;
		
		const {smartAccountAddress:retaddr} = await BastionViem.getAddress();
		expect(aaAddress).toEqual(retaddr)

		//by passing only msg
		// const signature = await BastionViem.signMessage("hello world");
		// expect(signature).toEqual("0x51af0110abe4ca72cdf03be9c88cc57bd261f2f68795f88efba6dd932beed61e52e96053ec73b2877ec61c1bac107d66ac3d5001f0cd2d3f3c9000c31b91e7731c");
		// //by passing account and msg
		// const signatureByAcc = await BastionViem.signMessage("hello world", account);
		// expect(signatureByAcc).toEqual("0x51af0110abe4ca72cdf03be9c88cc57bd261f2f68795f88efba6dd932beed61e52e96053ec73b2877ec61c1bac107d66ac3d5001f0cd2d3f3c9000c31b91e7731c");

	}, 70000);


	it.skip("should mint an NFT with gas from Smart Account", async () => {
		let bastion = new Bastion();
		const BastionViem = await bastion.viemConnect;

		DEFAULT_CONFIG.noSponsorship = true;
		const { smartAccountAddress: aaAddress }  = await BastionViem.init(publicClient,walletClient, DEFAULT_CONFIG);

		const contractAddress = BastionSampleNFT;
		const contractABI = ["function safeMint(address to) public"];

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

	it.skip("should mint an NFT with LINK ERC20 gas", async () => {
		let bastion = new Bastion();
		const BastionViem = await bastion.viemConnect;

		//This is LINK tokens on arb-goerli : "0xd14838A68E8AFBAdE5efb411d5871ea0011AFd28"
		// Stackup Test ERC20 gas token  = 0x3870419Ba2BBf0127060bCB37f69A1b1C090992B
		DEFAULT_CONFIG.gasToken = "0xd14838A68E8AFBAdE5efb411d5871ea0011AFd28";
		// DEFAULT_CONFIG.gasToken = "0x3870419Ba2BBf0127060bCB37f69A1b1C090992B";
		const { smartAccountAddress: aaAddress }  = await BastionViem.init(publicClient,walletClient, DEFAULT_CONFIG);

		const contractAddress = BastionSampleNFT;
		const contractABI = ["function safeMint(address to) public"];

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

    it.skip("should mint a NFT gaslessly with simulateContract method", async () => {
		let bastion = new Bastion();
		const BastionViem = await bastion.viemConnect;
		//Pass along a gasToken to use for gas
		const { smartAccountAddress: aaAddress }  = await BastionViem.init(publicClient,walletClient, DEFAULT_CONFIG);

		const contractAddress = BastionSampleNFT;

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

	it("should mint a NFT gaslessly by calling standalone writeContract method", async () => {
		let bastion = new Bastion();
		const BastionViem = await bastion.viemConnect;
		//Pass along a gasToken to use for gas
		const { smartAccountAddress: aaAddress, exists }  = await BastionViem.init(publicClient,walletClient, DEFAULT_CONFIG);
		console.log("exist",exists);
		if(!exists){
			const receipt = await BastionViem.createSmartAccountByDapp();
		}
		const contractAddress = BastionSampleNFT;

		const trxhash = await BastionViem.writeContract({
			account,
			address: contractAddress as `0x${string}`,
			abi: abi,
			functionName: 'safeMint',
			args: ["0x4A7EaF2a765B78B37F3D16A5eCcB1Ffd59788dBf"],
			chain: getViemChain(DEFAULT_CONFIG.chainId)
		});
		console.log("Trx hash:", trxhash);
		expect(trxhash).toHaveLength(66);
	}, 70000);

	it.skip("should batch mint 2 NFTs at a time", async () => {
		let bastion = new Bastion();
		const BastionViem = await bastion.viemConnect;
		//Pass along a gasToken to use for gas
		const { smartAccountAddress: aaAddress }  = await BastionViem.init(publicClient,walletClient, DEFAULT_CONFIG);

		const contractAddress = BastionSampleNFT;
		// const contractAddress2 = "0xf56AEcB7F7739637FEFc0DC7Fe593BF0Bc5801bF";
		const transaction1 = {
			account,
			address: contractAddress as `0x${string}`,
			abi: abi,
			functionName: 'safeMint',
			args: [aaAddress],
			chain: getViemChain(DEFAULT_CONFIG.chainId)
		}

		const transaction2 = {
			account,
			address: contractAddress as `0x${string}`,
			abi: abi,
			functionName: 'safeMint',
			args: [aaAddress],
			chain: getViemChain(DEFAULT_CONFIG.chainId)
		}

		const trxhash = await BastionViem.writeContractBatch([transaction1,transaction2]);
		console.log("Trx hash:", trxhash);
		expect(trxhash).toHaveLength(66);
	}, 70000);

})
