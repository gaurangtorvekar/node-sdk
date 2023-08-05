import { ethers, Contract } from "ethers";
import { SmartWallet } from "../../../src/modules/smart-wallet";
import { BastionSigner, BastionSignerOptions } from "../../../src/modules/bastion-signer";
import { SimpleAccountFactory__factory, EntryPoint__factory, SimpleAccount__factory, EntryPoint, UserOperationStruct } from "@account-abstraction/contracts";
import { describe, beforeEach, it, expect } from "@jest/globals";
import { skip } from "node:test";

let smartWallet: SmartWallet;
let walletConnected;
let provider;

const DEFAULT_CONFIG: BastionSignerOptions = {
	privateKey: process.env.PRIVATE_KEY || "",
	// rpcUrl: process.env.RPC_URL1 || "", //mumbai
	// chainId: 80001,
	// rpcUrl: process.env.RPC_URL2 || "", // goerli
	// chainId: 5,
	rpcUrl: process.env.RPC_URL3 || "", //arb-goerli
	chainId: 421613,
};

const setup = () => {
	const wallet = new ethers.Wallet(DEFAULT_CONFIG.privateKey);
	provider = new ethers.providers.JsonRpcProvider(DEFAULT_CONFIG.rpcUrl);
	walletConnected = wallet.connect(provider);
	return walletConnected;
};

describe("setupSmartAccount", () => {
	beforeEach(() => {
		const config = {
			apiKey: "testApiKey",
			baseUrl: "testBaseUrl",
		};
		smartWallet = new SmartWallet(config);
		walletConnected = setup();
	});
	const expectedAddress = "0xB730d07F4c928AD9e72B59AB99d22cB87BE9A867"; // replace with actual expected address

	it.skip("should call a Smart Contract function gasless", async () => {
		let bastionSigner = new BastionSigner();
		await bastionSigner.init(provider, DEFAULT_CONFIG);

		//This contract is deployed on arb-goerli
		const contractAddress = "0xEAC57C1413A2308cd03eF3CEa5c9224487825341";
		const contractABI = ["function safeMint(address to) public", "function balanceOf(address owner) external view returns (uint256 balance)"];

		const address = await bastionSigner.getAddress();
		const nftContract = new Contract(contractAddress, contractABI, bastionSigner);

		const res = await nftContract.safeMint(address);
		expect(res.hash).toHaveLength(66);
	}, 70000);

	it.skip("should call a Smart Contract function gasless for ERC20 gas", async () => {
		let bastionSigner = new BastionSigner();

		//Pass along a gasToken to use for gas
		DEFAULT_CONFIG.gasToken = "DAI";
		await bastionSigner.init(provider, DEFAULT_CONFIG);

		//This contract is deployed on arb-goerli
		const contractAddress = "0xEAC57C1413A2308cd03eF3CEa5c9224487825341";
		const contractABI = ["function safeMint(address to) public", "function balanceOf(address owner) external view returns (uint256 balance)"];

		const address = await bastionSigner.getAddress();
		const nftContract = new Contract(contractAddress, contractABI, bastionSigner);

		const res = await nftContract.safeMint(address);
		expect(res.hash).toHaveLength(66);
	}, 70000);

	it("should send native currency to another address gassless", async () => {
		let bastionSigner = new BastionSigner();
		await bastionSigner.init(provider, DEFAULT_CONFIG);

		console.log("My address = ", await bastionSigner.getAddress());

		const res = await bastionSigner.sendTransaction({
			to: "0x2429EB38cB9b456160937e11aefc80879a2d2712",
			value: 10,
		});
		expect(res.hash).toHaveLength(66);
	}, 50000);

	it.skip("should withdraw from entry point", async () => {
		let bastionSigner = new BastionSigner();
		await bastionSigner.init(provider, DEFAULT_CONFIG);

		const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
		const entryPoint = EntryPoint__factory.connect(ENTRY_POINT_ADDRESS, bastionSigner);

		const deposit = await entryPoint.balanceOf("0x21Bcf2cDaAFd8eb972B3296AFf0eF24BD09dc256");

		const res = await entryPoint.withdrawTo("0x2429EB38cB9b456160937e11aefc80879a2d2712", deposit);
		expect(res.hash).toHaveLength(66);

		expect(true).toBe(true);
	}, 70000);
});

