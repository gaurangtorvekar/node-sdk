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

		it("should return expected sender address by calling getSmartAccountAddress", async () => {
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

		it("should send native currency UserOp and return true", async () => {
			let result;
			try {
				result = await smartWallet.sendNativeCurrency(
					{
						privateKey: process.env.PRIVATE_KEY || "",
						rpcUrl: process.env.RPC_URL2 || "", // Polygon Mumbai
						chainId: 421613,
					},
					"0x841056F279582d1dfD586c3C77e7821821B5B510",
					20,
					"0x"
				);
			} catch (e) {
				console.log("e:", e);
			}
			expect(result).toEqual(true);
		}, 20000);
	});
});

