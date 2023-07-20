import { ethers } from "ethers";
import { SmartWallet } from "../../../src/modules/smart-wallet";
import { describe, beforeEach, it, expect } from "@jest/globals";

let smartWallet: SmartWallet;
let walletConnected;
let provider;

const DEFAULT_CONFIG = {
	privateKey: process.env.PRIVATE_KEY || "",
	rpcUrl: process.env.RPC_URL1 || "",
	chainId: 80001,
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
		const expectedAddress = "0xbF874b81636F3FA36643A5996Cd5c187689609d7"; // replace with actual expected address

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
		}, 20000);

		it("should send native currency UserOp and return true", async () => {
			let result = await smartWallet.sendNativeCurrency(provider, "0x841056F279582d1dfD586c3C77e7821821B5B510", 19, DEFAULT_CONFIG, "0x", process.env.PIMLICO_API_KEY);
			expect(result).toEqual(true);
		}, 70000);

		it.skip("should send gasless native currency userop and return true", async () => {
			let result = await smartWallet.sendNativeCurrencyGasless(provider, "0x841056F279582d1dfD586c3C77e7821821B5B510", 22, DEFAULT_CONFIG, "0x", process.env.PIMLICO_API_KEY);
			expect(result).toEqual(true);
		}, 50000);

		it.skip("should send ERC20 UserOp and return true", async () => {
			let result = await smartWallet.sendTokens(provider, "0x841056F279582d1dfD586c3C77e7821821B5B510", 300, "0xe11A86849d99F524cAC3E7A0Ec1241828e332C62", DEFAULT_CONFIG, process.env.PIMLICO_API_KEY);
			expect(result).toEqual(true);
		}, 50000);

		it.skip("should send ERC20 UserOp gasless and return true", async () => {
			let result = await smartWallet.sendTokensGasless(
				provider,
				"0x841056F279582d1dfD586c3C77e7821821B5B510",
				320,
				"0xe11A86849d99F524cAC3E7A0Ec1241828e332C62",
				DEFAULT_CONFIG,
				process.env.PIMLICO_API_KEY
			);
			expect(result).toEqual(true);
		}, 70000);

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
	});
});

