import { SmartWallet } from "../../../src/modules/smart-wallet";
const { ethers } = require("ethers");

describe("SmartWallet", () => {
	let smartWallet: SmartWallet;

	beforeEach(() => {
		const config = {
			apiKey: "testApiKey",
			baseUrl: "testBaseUrl",
		};
		smartWallet = new SmartWallet(config);
	});

	describe("setupSmartAccount", () => {
		const expectedAddress = "0xbF874b81636F3FA36643A5996Cd5c187689609d7"; // replace with actual expected address

		it.skip("should return expected sender address by calling getSmartAccountAddress", async () => {
			let result;
			try {
				result = await smartWallet.getSmartAccountAddress({
					privateKey: process.env.PRIVATE_KEY || "",
					rpcUrl: process.env.RPC_URL1 || "", // Polygon Mumbai
					chainId: 80001,
				});
			} catch (e) {
				console.log("e:", e);
			}
			expect(result).toEqual(expectedAddress);
		});

		it.skip("should return the same sender address by calling getSmartAccountAddress on another chain", async () => {
			let result;
			try {
				result = await smartWallet.getSmartAccountAddress({
					privateKey: process.env.PRIVATE_KEY || "",
					rpcUrl: process.env.RPC_URL2 || "", // Arbitrum Goerli
					chainId: 421613,
				});
			} catch (e) {
				console.log("e:", e);
			}
			expect(result).toEqual(expectedAddress);
		});

		// Note - Had to add a timeout to this test because Blockchain TXNs take time
		// Skipping this test for now because we don't want to create a new smart account every time we run the tests
		it.skip("should create a Smart Account and return true", async () => {
			let result;
			try {
				result = await smartWallet.initSmartAccount({
					privateKey: process.env.PRIVATE_KEY || "",
					rpcUrl: process.env.RPC_URL2 || "", // Arbitrum Goerli
					chainId: 421613,
				});
			} catch (e) {
				console.log("e:", e);
			}
			expect(result).toEqual(true);
		}, 20000);

		it.skip("should send native currency UserOp and return true", async () => {
			let result;
			try {
				result = await smartWallet.sendNativeCurrency(
					{
						privateKey: process.env.PRIVATE_KEY || "",
						rpcUrl: process.env.RPC_URL || "", // Polygon Mumbai
						chainId: 80001,
					},
					"0x841056F279582d1dfD586c3C77e7821821B5B510",
					21,
					"0x"
				);
			} catch (e) {
				console.log("e:", e);
			}
			expect(result).toEqual(true);
		}, 20000);

		it.skip("should send gasless native currency userop and return true", async () => {
			let result;

			try {
				result = await smartWallet.sendNativeCurrencyGassless(
					{
						privateKey: process.env.PRIVATE_KEY || "",
						rpcUrl: process.env.RPC_URL || "", // Polygon Mumbai
						chainId: 80001,
					},
					"0x841056F279582d1dfD586c3C77e7821821B5B510",
					22,
					"0x"
				);
			} catch (e) {
				console.log("e:", e);
			}
		}, 50000);

		it.skip("should send ERC20 UserOp and return true", async () => {
			let result;
			try {
				result = await smartWallet.sendERC20Tokens(
					{
						privateKey: process.env.PRIVATE_KEY || "",
						rpcUrl: process.env.RPC_URL || "", // Polygon Mumbai
						chainId: 80001,
					},
					"0x841056F279582d1dfD586c3C77e7821821B5B510",
					300,
					"0xe11A86849d99F524cAC3E7A0Ec1241828e332C62"
				);
			} catch (e) {
				console.log("e:", e);
			}
			expect(result).toEqual(true);
		}, 50000);

		it.skip("should send ERC20 UserOp gasless and return true", async () => {
			let result;

			try {
				result = await smartWallet.sendERC20TokensGasless(
					{
						privateKey: process.env.PRIVATE_KEY || "",
						rpcUrl: process.env.RPC_URL || "", // Polygon Mumbai
						chainId: 80001,
					},
					"0x841056F279582d1dfD586c3C77e7821821B5B510",
					400,
					"0xe11A86849d99F524cAC3E7A0Ec1241828e332C62"
				);
			} catch (e) {
				console.log("e", e);
			}
		}, 70000);

		it.skip("should return the balance of native currency", async () => {
			let result;
			try {
				result = await smartWallet.getNativeCurrencyBalance({
					privateKey: process.env.PRIVATE_KEY || "",
					rpcUrl: process.env.RPC_URL || "", // Polygon Mumbai
					chainId: 80001,
				});
			} catch (e) {
				console.log("e:", e);
			}
			expect(result).toBeGreaterThan(0);
		});

		it("should return the balance of ERC20 tokens", async () => {
			let result;
			try {
				result = await smartWallet.getERC20TokenBalance(
					{
						privateKey: process.env.PRIVATE_KEY || "",
						rpcUrl: process.env.RPC_URL || "", // Polygon Mumbai
						chainId: 80001,
					},
					"0x326C977E6efc84E512bB9C30f76E30c160eD06FB"
				);
			} catch (e) {
				console.log("e:", e);
			}
			expect(result).toBeGreaterThan(0);
		});

		it("should return the balance of a batch of ERC20 tokens", async () => {
			let result;
			try {
				result = await smartWallet.getERC20TokenBalanceBatch(
					{
						privateKey: process.env.PRIVATE_KEY || "",
						rpcUrl: process.env.RPC_URL || "", // Polygon Mumbai
						chainId: 80001,
					},
					["0xe11A86849d99F524cAC3E7A0Ec1241828e332C62", "0x326C977E6efc84E512bB9C30f76E30c160eD06FB"]
				);
			} catch (e) {
				console.log("e:", e);
			}
			const allGreaterThanZero = result.every((value) => value > 0);
			expect(allGreaterThanZero).toBe(true);
		});

		it.skip("should return true if smart account is deployed", async () => {
			let result;
			try {
				result = await smartWallet.isSmartAccountDeployed({
					privateKey: process.env.PRIVATE_KEY || "",
					rpcUrl: process.env.RPC_URL || "", // Polygon Mumbai
					chainId: 80001,
				});
			} catch (e) {
				console.log("e:", e);
			}
		});
	});
});

