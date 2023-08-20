import { ethers } from "ethers";
import { SmartWallet } from "../../../src/modules/smart-wallet";
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

