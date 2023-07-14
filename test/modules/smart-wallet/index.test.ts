import { SmartWallet } from "../../../src/modules/smart-wallet";

describe("SmartWallet", () => {
	let smartWallet: SmartWallet;

	beforeEach(() => {
		// Assuming the Base class doesn't need any arguments
		// Adjust this as per your needs
		const config = {
			apiKey: "testApiKey",
			baseUrl: "testBaseUrl",
		};
		smartWallet = new SmartWallet(config);
	});

	// describe("init", () => {
	// 	it("should initialize", async () => {
	// 		// We are not actually testing the function here since it does not return anything or have observable side effects.
	// 		// In real-world scenarios, you would spy on functions called inside `init` or mock certain behaviors.
	// 		await expect(smartWallet.init()).resolves.toBeUndefined();
	// 	});
	// });

	describe("sampleFunc", () => {
		it("should return the correct response", () => {
			const sampleOptions = { sampleArg: "Test Arg" }; // replace this with the actual options if needed
			const result = smartWallet.sampleFunc(sampleOptions);

			expect(result).toEqual({ retArg: "sampleResponse1" });
		});
	});
});

