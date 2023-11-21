import { TransactionReceipt } from "@ethersproject/providers";
import { BigNumber } from "ethers";

export const getChainName = async (chainId) => {
	switch (chainId) {
		case 80001:
			return "polygon-mumbai";
		case 421613:
			return "arbitrum-goerli";
		case 534353:
			return "scroll-sepolia-testnet";
		case 59140:
			return "linea-testnet";
		case 167004:
			return "taiko-aplha-2-testnet";
		case 84531:
			return "base-goerli-testnet";
		case 8453:
			return "base";
		case 420:
			return "optimism-goerli";
	}
};

export const checkChainCompatibility = async (chainId) => {
	const chainName = await getChainName(chainId);
	if (!chainName) {
		throw new Error("Chain not supported");
	}
	return chainName;
};

export const createDummyTransactionReceipt = async () => {
	const transactionReceipt: TransactionReceipt = {
		to: "0x000000000000",
		from: "0x0000000000",
		contractAddress: "0x000000000000",
		transactionIndex: 0,
		gasUsed: BigNumber.from(0),
		logsBloom: "0x000000000000",
		blockHash: "0x000000000000",
		transactionHash: "0x000000000000",
		logs: [],
		blockNumber: 0,
		confirmations: 0,
		cumulativeGasUsed: BigNumber.from(0),
		effectiveGasPrice: BigNumber.from(0),
		byzantium: false,
		type: 0,
	};

	return transactionReceipt;
};

