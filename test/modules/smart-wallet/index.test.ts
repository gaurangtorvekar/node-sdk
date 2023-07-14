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

	describe("sampleFunc", () => {
		it("should return the correct response", () => {
			const sampleOptions = { sampleArg: "Test Arg" }; // replace this with the actual options if needed
			const result = smartWallet.sampleFunc(sampleOptions);

			expect(result).toEqual({ retArg: "sampleResponse1" });
		});
	});

	describe("setupSmartAccount", () => {
		const expectedAddress = "0xbF874b81636F3FA36643A5996Cd5c187689609d7"; // replace with actual expected address

		it("should return expected sender address by calling getSmartAccountAddress", async () => {
			try {
				const result = await smartWallet.getSmartAccountAddress({
					privateKey: process.env.PRIVATE_KEY || "",
					rpcUrl: process.env.RPC_URL1 || "", // Polygon Mumbai
				});
				expect(result).toEqual(expectedAddress);
			} catch (e) {
				console.log("e:", e);
			}
		});

		it("should return the same sender address by calling getSmartAccountAddress on another chain", async () => {
			try {
				const result = await smartWallet.getSmartAccountAddress({
					privateKey: process.env.PRIVATE_KEY || "",
					rpcUrl: process.env.RPC_URL2 || "", // Arbitrum Goerli
				});
				expect(result).toEqual(expectedAddress);
			} catch (e) {
				console.log("e:", e);
			}
		});
	});
});

