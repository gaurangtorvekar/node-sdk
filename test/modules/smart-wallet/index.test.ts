import { ethers, Contract } from "ethers";
import { SmartWallet } from "../../../src/modules/smart-wallet";
import { BastionSigner } from "../../../src/modules/bastionConnect";
import { describe, beforeEach, it, expect } from "@jest/globals";
import { skip } from "node:test";

let smartWallet: SmartWallet;
let walletConnected;
let provider;

const DEFAULT_CONFIG = {
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

describe("SmartWallet", () => {
	beforeEach(() => {
		const config = {
			apiKey: "testApiKey",
			baseUrl: "testBaseUrl",
		};
		smartWallet = new SmartWallet(config);
		walletConnected = setup();
	});

	describe("setupSmartAccount", () => {
		const expectedAddress = "0xB730d07F4c928AD9e72B59AB99d22cB87BE9A867"; // replace with actual expected address

		it.skip("should return expected sender address by calling getSmartAccountAddress", async () => {
			let result = await smartWallet.getSmartAccountAddress(provider, DEFAULT_CONFIG);
			expect(result).toEqual(expectedAddress);
		});

		// it.skip("should return the same sender address by calling getSmartAccountAddress on another chain", async () => {
		// 	let result = await smartWallet.getSmartAccountAddress(DEFAULT_CONFIG);
		// 	expect(result).toEqual(expectedAddress);
		// });

		// Note - Had to add a timeout to this test because Blockchain TXNs take time
		// Skipping this test for now because we don't want to create a new smart account every time we run the tests
		it.skip("should create a Smart Account and return true", async () => {
			let result = await smartWallet.initSmartAccount(provider, DEFAULT_CONFIG);
			expect(result).toEqual(true);
			let result2 = await smartWallet.getSmartAccountAddress(provider, DEFAULT_CONFIG);
			expect(result2).toEqual(expectedAddress);
		}, 20000);

		// it.skip("should send ERC20 batch UserOp and return userOp hash", async () => {
		// 	let result = await smartWallet.sendTokensBatch(
		// 		provider,
		// 		["0x841056F279582d1dfD586c3C77e7821821B5B510", "0x841056F279582d1dfD586c3C77e7821821B5B510"],
		// 		[305, 310],
		// 		["0xe11A86849d99F524cAC3E7A0Ec1241828e332C62", "0x326C977E6efc84E512bB9C30f76E30c160eD06FB"],
		// 		DEFAULT_CONFIG
		// 	);
		// 		console.log("UserOperation hash:", result);
		// 		expect(result).toHaveLength(66);
		// }, 50000);

		it.skip("should return the balance of native currency", async () => {
			let result = await smartWallet.getNativeCurrencyBalance(provider, DEFAULT_CONFIG);
			expect(result).toBeGreaterThan(0);
		});

		it.skip("should return the balance of ERC20 tokens", async () => {
			let result = await smartWallet.getERC20TokenBalance(provider, "0x326C977E6efc84E512bB9C30f76E30c160eD06FB", DEFAULT_CONFIG);
			expect(result).toBeGreaterThan(0);
		});

		it.skip("should return the balance of a batch of ERC20 tokens", async () => {
			let result = await smartWallet.getERC20TokenBalanceBatch(provider, ["0xe11A86849d99F524cAC3E7A0Ec1241828e332C62", "0x326C977E6efc84E512bB9C30f76E30c160eD06FB"], DEFAULT_CONFIG);
			const allGreaterThanZero = result.every((value) => value > 0);
			expect(allGreaterThanZero).toBe(true);
		});

		it.skip("should return true if smart account is deployed", async () => {
			let result = await smartWallet.isSmartAccountDeployed(provider, DEFAULT_CONFIG);
			expect(result).toEqual(true);
		});

		// it.skip("should return the deposit amount of the Smart Account from Entry Point", async () => {
		// 	let result = await smartWallet.getEntryPointDeposit(provider, DEFAULT_CONFIG);
		// 	expect(result).toBeGreaterThan(0);
		// });

		// it.skip("should withdraw deposit of the Smart Account from the Entry Point contract", async () => {
		// 	let result = await smartWallet.withdrawDepositFromEntryPoint(provider, DEFAULT_CONFIG);
		// 	expect(result).toHaveLength(66);
		// }, 70000);
	});
});

