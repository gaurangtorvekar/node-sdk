import { ParticleNetwork, WalletEntryPosition } from "@particle-network/auth";
import { ParticleProvider } from "@particle-network/provider";
import React, { useState } from "react";
import { ethers } from "ethers";
import { Bastion } from "@bastion/sdk";

export default function LoginPage() {
	const bastion = new Bastion({
		apiKey: "your-api-key",
		baseUrl: "https://jsonplaceholder.typicode.com",
	});

	const loginWithProvider = async (loginProvider: string) => {
		console.log("Inside the function");

		try {
			const particle = new ParticleNetwork({
				projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID as string,
				clientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY as string,
				appId: process.env.NEXT_PUBLIC_PARTICLE_APP_ID as string,
				chainName: "polygon",
				chainId: 80001,
			});
			console.log("Particle: ", particle);
			const userInfo = await particle.auth.login();
			console.log("Logged in user:", userInfo);
			const particleProvider = new ParticleProvider(particle.auth);
			const ethersProvider = new ethers.providers.Web3Provider(particleProvider, "any");
			console.log("Logged in user:", await ethersProvider.getSigner().getAddress());
			// const getSmartAccountAddress = await bastion.smartWallet.getSmartAccountAddress(ethersProvider);

			// const smartAccountCreated = await bastion.smartWallet.initSmartAccount(ethersProvider);

			// const txReceipt = await bastion.smartWallet.sendNativeCurrency(
			// 	ethersProvider,
			// 	"0x841056F279582d1dfD586c3C77e7821821B5B510",
			// 	11,
			// 	{
			// 		privateKey: process.env.NEXT_PUBLIC_PRIVATE_KEY || "",
			// 		rpcUrl: process.env.NEXT_PUBLIC_RPC_URL1 || "",
			// 		chainId: 80001,
			// 	},
			// 	"0x",
			// 	process.env.NEXT_PUBLIC_PIMLICO_API_KEY
			// );

			// await bastion.smartWallet.getNativeCurrencyBalance(ethersProvider);

			// await bastion.smartWallet.getERC20TokenBalance(ethersProvider, "0x326C977E6efc84E512bB9C30f76E30c160eD06FB");

			// await bastion.smartWallet.getERC20TokenBalanceBatch(ethersProvider, [
			// 	"0xe11A86849d99F524cAC3E7A0Ec1241828e332C62",
			// 	"0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
			// ]);

			// await bastion.smartWallet.isSmartAccountDeployed(ethersProvider);

			// const txReceipt = await bastion.smartWallet.sendNativeCurrencyGasless(
			// 	ethersProvider,
			// 	"0x841056F279582d1dfD586c3C77e7821821B5B510",
			// 	12,
			// 	{
			// 		privateKey: process.env.NEXT_PUBLIC_PRIVATE_KEY || "",
			// 		rpcUrl: process.env.NEXT_PUBLIC_RPC_URL1 || "",
			// 		chainId: 80001,
			// 	},
			// 	"0x",
			// 	process.env.NEXT_PUBLIC_PIMLICO_API_KEY
			// );

			// const txReceipt = await bastion.smartWallet.sendTokens(
			// 	ethersProvider,
			// 	"0x841056F279582d1dfD586c3C77e7821821B5B510",
			// 	123,
			// 	"0xe11A86849d99F524cAC3E7A0Ec1241828e332C62",
			// 	{
			// 		privateKey: process.env.NEXT_PUBLIC_PRIVATE_KEY || "",
			// 		rpcUrl: process.env.NEXT_PUBLIC_RPC_URL1 || "",
			// 		chainId: 80001,
			// 	},
			// 	process.env.NEXT_PUBLIC_PIMLICO_API_KEY
			// );

			const txReceipt = await bastion.smartWallet.sendTokensGasless(
				ethersProvider,
				"0x841056F279582d1dfD586c3C77e7821821B5B510",
				321,
				"0xe11A86849d99F524cAC3E7A0Ec1241828e332C62",
				{
					privateKey: process.env.NEXT_PUBLIC_PRIVATE_KEY || "",
					rpcUrl: process.env.NEXT_PUBLIC_RPC_URL1 || "",
					chainId: 80001,
				},
				process.env.NEXT_PUBLIC_PIMLICO_API_KEY
			);
		} catch (e) {
			console.error(e);
		}
	};

	return (
		<div className="flex flex-col items-center min-h-screen bg-gray-100 py-2">
			<div className="p-6 max-w-sm w-full bg-white shadow-md rounded-md mt-20">
				<div className="flex justify-center items-center">
					<span className="text-gray-700 font-semibold">Login with</span>
				</div>

				<div className="mt-4">
					<button onClick={() => loginWithProvider("Google")} className="py-2 px-4 w-full text-center bg-red-600 rounded-md text-white text-sm hover:bg-red-500">
						Google
					</button>
				</div>

				<div className="mt-4">
					<button onClick={() => loginWithProvider("LinkedIn")} className="py-2 px-4 w-full text-center bg-blue-600 rounded-md text-white text-sm hover:bg-blue-500">
						LinkedIn
					</button>
				</div>

				<div className="mt-4">
					<button onClick={() => loginWithProvider("Facebook")} className="py-2 px-4 w-full text-center bg-blue-400 rounded-md text-white text-sm hover:bg-blue-300">
						Facebook
					</button>
				</div>
			</div>
		</div>
	);
}

