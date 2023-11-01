import { ethers, Contract } from "ethers";
import { SmartWallet } from "../../../src/modules/smart-wallet";
import { BastionSignerOptions } from "../../../src/modules/bastionConnect";
import { Bastion } from "../../../src/index";
import { EntryPoint__factory } from "@account-abstraction/contracts";
import { describe, beforeEach, it, expect } from "@jest/globals";
import { skip } from "node:test";
import { ERC721_ABI } from "../../utils/ERC721_ABI";

let smartWallet: SmartWallet;
let walletConnected;
let provider;
let BastionSampleNFT = "0xb390e253e43171a11a6afcb04e340fde5ae1b0a1";

const DEFAULT_CONFIG: BastionSignerOptions = {
	privateKey: process.env.PRIVATE_KEY || "",
	rpcUrl: process.env.RPC_URL1 || "", //mumbai
	chainId: 80001,
	// rpcUrl: process.env.RPC_URL2 || "", // arb-goerli
	// chainId: 421613,
	// rpcUrl: process.env.RPC_URL3 || "", // scroll
	// chainId: 534353,
	// rpcUrl: process.env.RPC_URL4 || "", // linea
	// chainId: 59140,
	// rpcUrl: process.env.RPC_URL5 || "", // base-goerli
	// chainId: 84531,
	// rpcUrl: process.env.RPC_URL6 || "", // optimism-goerli
	// chainId: 420,
	// rpcUrl: process.env.RPC_URL7 || "", // Polygon-mainnet
	// chainId: 137,
	apiKey: process.env.BASTION_API_KEY || "",
};

const setup = () => {
	const wallet = new ethers.Wallet(DEFAULT_CONFIG.privateKey || "");
	provider = new ethers.providers.JsonRpcProvider(DEFAULT_CONFIG.rpcUrl);
	walletConnected = wallet.connect(provider);
	return walletConnected;
};

// //--- Start of tests for multi chain
// const setupTestEnvironment = async (config) => {
// 	const bastionConnect = new BastionConnect();
// 	await bastionConnect.init(provider, config);
// 	const address = await bastionConnect.getAddress();
// 	const nftContract = new Contract(BastionSampleNFT, ["function safeMint(address to) public"], bastionConnect);

// 	return { address, nftContract };
// };

// const testMintingNFT = async (config) => {
// 	const { address, nftContract } = await setupTestEnvironment(config);

// 	const res = await nftContract.safeMint(address);
// 	console.log("res = ", res);

// 	expect(res.userOperationHash).toHaveLength(66);
// };

// const testCases = [
// 	// { chainId: 80001, rpcUrlEnv: "RPC_URL1", desc: "on Polygon Mumbai" },
// 	// { chainId: 421613, rpcUrlEnv: "RPC_URL2", desc: "on Arbitrum Goerli" },
// 	// { chainId: 534353, rpcUrlEnv: "RPC_URL3", desc: "on Scroll alpha testnet" },
// 	// { chainId: 59140, rpcUrlEnv: "RPC_URL4", desc: "on Linea testnet" },
// 	// { chainId: 84531, rpcUrlEnv: "RPC_URL5", desc: "on Base Goerli testnet" },
// 	// { chainId: 420, rpcUrlEnv: "RPC_URL6", desc: "on Optimism Goerli" },
// ];

// describe("Multi-chain NFT minting tests", () => {
// 	beforeEach(() => {
// 		smartWallet = new SmartWallet();
// 		walletConnected = setup();
// 	});
// 	for (const { chainId, rpcUrlEnv, desc } of testCases) {
// 		it(`should mint an NFT gasless-ly ${desc}`, async () => {
// 			DEFAULT_CONFIG.chainId = chainId;
// 			DEFAULT_CONFIG.rpcUrl = process.env[rpcUrlEnv] || "";

// 			await testMintingNFT(DEFAULT_CONFIG);
// 		}, 70000);
// 	}
// });
// //--- End of tests for multi chain

describe("setupSmartAccount", () => {
	beforeEach(() => {
		smartWallet = new SmartWallet();
		walletConnected = setup();
	});
	const expectedAddress = "0xB730d07F4c928AD9e72B59AB99d22cB87BE9A867"; // replace with actual expected address

	it.skip("should call a Smart Contract function gasless for ERC20 gas", async () => {
		let bastion = new Bastion();
		const bastionConnect = await bastion.bastionConnect;

		//Pass along a gasToken to use for gas
		DEFAULT_CONFIG.gasToken = "DAI";
		await bastionConnect.init(provider, DEFAULT_CONFIG);

		const contractAddress = "0xEAC57C1413A2308cd03eF3CEa5c9224487825341";
		const contractABI = ["function safeMint(address to) public", "function balanceOf(address owner) external view returns (uint256 balance)"];

		const address = await bastionConnect.getAddress();
		const nftContract = new Contract(contractAddress, contractABI, bastionConnect);

		const res = await nftContract.safeMint(address);
		expect(res.hash).toHaveLength(66);
	}, 70000);

	it.skip("should withdraw from entry point", async () => {
		let bastion = new Bastion();
		const bastionConnect = await bastion.bastionConnect;
		await bastionConnect.init(provider, DEFAULT_CONFIG);

		const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
		const entryPoint = EntryPoint__factory.connect(ENTRY_POINT_ADDRESS, bastionConnect);

		const deposit = await entryPoint.balanceOf("0x21Bcf2cDaAFd8eb972B3296AFf0eF24BD09dc256");

		const res = await entryPoint.withdrawTo("0x2429EB38cB9b456160937e11aefc80879a2d2712", deposit);
		expect(res.hash).toHaveLength(66);

		expect(true).toBe(true);
	}, 70000);

	it.skip("should send test LINK tokens gasless", async () => {
		let bastion = new Bastion();
		const bastionConnect = await bastion.bastionConnect;
		await bastionConnect.init(provider, DEFAULT_CONFIG);

		const contractAddress = "0xd14838A68E8AFBAdE5efb411d5871ea0011AFd28";
		const contractABI = ["function transfer(address recipient, uint256 amount) public virtual override returns (bool) "];

		const linkContract = new Contract(contractAddress, contractABI, bastionConnect);
		const res = await linkContract.transfer("0x2429EB38cB9b456160937e11aefc80879a2d2712", 10);
		expect(res.hash).toHaveLength(66);
	}, 70000);

	it.skip("should mint an NFT with gas from Smart Account", async () => {
		let bastion = new Bastion();
		const bastionConnect = await bastion.bastionConnect;

		DEFAULT_CONFIG.noSponsorship = true;
		await bastionConnect.init(provider, DEFAULT_CONFIG);

		const contractAddress = BastionSampleNFT;
		const contractABI = ["function safeMint(address to) public"];

		const address = await bastionConnect.getAddress();
		const nftContract = new Contract(contractAddress, contractABI, bastionConnect);

		const res = await nftContract.safeMint(address);
		expect(res.hash).toHaveLength(66);
	}, 70000);

	it.skip("should mint an NFT with LINK ERC20 gas", async () => {
		let bastion = new Bastion();
		const bastionConnect = await bastion.bastionConnect;

		//This is LINK tokens on arb-goerli : "0xd14838A68E8AFBAdE5efb411d5871ea0011AFd28"
		// Stackup Test ERC20 gas token  = 0x3870419Ba2BBf0127060bCB37f69A1b1C090992B
		DEFAULT_CONFIG.gasToken = "0xd14838A68E8AFBAdE5efb411d5871ea0011AFd28";
		// DEFAULT_CONFIG.gasToken = "0x3870419Ba2BBf0127060bCB37f69A1b1C090992B";
		await bastionConnect.init(provider, DEFAULT_CONFIG);

		const contractAddress = BastionSampleNFT;
		const contractABI = ["function safeMint(address to) public"];

		const address = await bastionConnect.getAddress();
		const nftContract = new Contract(contractAddress, contractABI, bastionConnect);

		const res = await nftContract.safeMint(address);
		expect(res.hash).toHaveLength(66);
	}, 70000);

	it.skip("should batch transfer 2 NFTs with LINK ERC20 gas", async () => {
		let bastion = new Bastion();
		const bastionConnect = await bastion.bastionConnect;

		//This is LINK tokens on arb-goerli : "0xd14838A68E8AFBAdE5efb411d5871ea0011AFd28"
		// Stackup Test ERC20 gas token  = 0x3870419Ba2BBf0127060bCB37f69A1b1C090992B
		DEFAULT_CONFIG.gasToken = "0xd14838A68E8AFBAdE5efb411d5871ea0011AFd28";
		// DEFAULT_CONFIG.gasToken = "0x3870419Ba2BBf0127060bCB37f69A1b1C090992B";
		await bastionConnect.init(provider, DEFAULT_CONFIG);
		const toAddress = "0x841056F279582d1dfD586c3C77e7821821B5B510";
		const fromAddress = await bastionConnect.getAddress();

		const contractAddress = BastionSampleNFT;
		const erc721Contract = new ethers.Contract(contractAddress, ERC721_ABI, bastionConnect);

		const transfer1 = {
			to: contractAddress,
			value: 0,
			data: erc721Contract.interface.encodeFunctionData("transferFrom", [fromAddress, toAddress, 111]),
		};

		const transfer2 = {
			to: contractAddress,
			value: 0,
			data: erc721Contract.interface.encodeFunctionData("transferFrom", [fromAddress, toAddress, 112]),
		};

		const transactionArray = [transfer1, transfer2];
		const res = await bastionConnect.executeBatch(transactionArray);
		console.log("res = ", res.hash);
		expect(res.hash).toHaveLength(66);
	}, 70000);

	it.skip("should mint an NFT gasless-ly", async () => {
		try {
			let bastion = new Bastion();
			const bastionConnect = await bastion.bastionConnect;
			await bastionConnect.init(provider, DEFAULT_CONFIG);

			const contractAddress = BastionSampleNFT;
			const contractABI = ["function safeMint(address to) public"];

			const address = await bastionConnect.getAddress();
			const nftContract = new Contract(contractAddress, contractABI, bastionConnect);

			const res = await nftContract.safeMint(address);
			console.log("res = ", res);
			// Sleep for 2 sec
			await new Promise((r) => setTimeout(r, 2000));
			const txnHash = await bastionConnect.getTransactionHash(res.hash);
			console.log("Hash for NFT mint = ", txnHash);
			expect(txnHash).toHaveLength(66);
		} catch (error) {
			console.log("error = ", error);
		}
	}, 70000);

	it.skip("should throw for invalid chainId", async () => {
		let bastion = new Bastion();
		const bastionConnect = await bastion.bastionConnect;

		DEFAULT_CONFIG.chainId = 1234;
		await expect(bastionConnect.init(provider, DEFAULT_CONFIG)).rejects.toThrow("Chain not supported");
	});

	it.skip("should not create a Smart Wallet when noSponsorship  is true", async () => {
		let bastion = new Bastion();
		const bastionConnect = await bastion.bastionConnect;

		DEFAULT_CONFIG.noSponsorship = true;
		await bastionConnect.init(provider, DEFAULT_CONFIG);

		let address = await bastionConnect.getAddress();
		console.log("address before = ", address);
		if (!address) {
			console.log("Creating Smart Account");
			address = await bastionConnect.createSmartAccount();
		}
		console.log("address after = ", address);
	}, 70000);

	it("should send native currency to another address with gas from Smart Account", async () => {
		// DEFAULT_CONFIG.noSponsorship = true;
		let bastion = new Bastion();
		const bastionConnect = await bastion.bastionConnect;
		await bastionConnect.init(provider, DEFAULT_CONFIG);

		console.log("My address = ", await bastionConnect.getAddress());

		const res = await bastionConnect.sendTransaction({
			to: "0xda8107332d3edC065753d23fe23a42a308Ac8879",
			value: 1,
		});
		console.log("Hash for native transfer = ", res.hash);
		expect(res.hash).toHaveLength(66);
	}, 50000);

	it.skip("should send an ERC20 token with gas from Smart Account", async () => {
		try {
			DEFAULT_CONFIG.noSponsorship = true;
			let bastion = new Bastion();
			const bastionConnect = await bastion.bastionConnect;
			await bastionConnect.init(provider, DEFAULT_CONFIG);

			const contractAddress = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
			const contractABI = ["function transfer(address to, uint256 amount) public"];

			const address = await bastionConnect.getAddress();
			console.log("My address = ", address);
			const erc2Contract = new Contract(contractAddress, contractABI, bastionConnect);

			const res = await erc2Contract.transfer("0xda8107332d3edC065753d23fe23a42a308Ac8879", ethers.utils.parseEther("0.1"));
			console.log("res = ", res.hash);
			expect(res.hash).toHaveLength(66);
		} catch (error) {
			console.log("error = ", error);
		}
	}, 70000);
});

