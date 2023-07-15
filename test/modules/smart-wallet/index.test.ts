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
				});
			} catch (e) {
				console.log("e:", e);
			}
			expect(result).toEqual(expectedAddress);
		});

		it("should return the same sender address by calling getSmartAccountAddress on another chain", async () => {
			let result;
			try {
				result = await smartWallet.getSmartAccountAddress({
					privateKey: process.env.PRIVATE_KEY || "",
					rpcUrl: process.env.RPC_URL2 || "", // Arbitrum Goerli
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
					rpcUrl: process.env.RPC_URL1 || "", // Arbitrum Goerli
				});
			} catch (e) {
				console.log("e:", e);
			}
			expect(result).toEqual(true);
		}, 20000);
	});
});

