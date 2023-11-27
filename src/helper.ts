import { TransactionReceipt } from "@ethersproject/providers";
import { BigNumber } from "ethers";
import { defineChain } from "viem";
import { mainnet, polygon, arbitrum, base, polygonMumbai, arbitrumGoerli, baseGoerli, scrollTestnet, lineaTestnet, optimismGoerli  } from "viem/chains";

export const mainnetIds = [1,137,42162,534352,8453];

export const getChainName = async (chainId) => {
	switch (chainId) {
		case 1: 
			return "ethereum";
		case 137: 
			return "polygon";
		case 42162:
			return "arbitrum";
		case 534352:
			return "scroll";
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

export const getViemChain =async(chainId:number) =>{
	switch (chainId) {
		case 1: 
			return mainnet;
		case 137: 
			return polygon;
		case 42162:
			return arbitrum;
		case 534352:
			return scroll;
		case 80001:
			return polygonMumbai;
		case 421613:
			return arbitrumGoerli;
		case 534353:
			return scrollTestnet;
		case 59140:
			return lineaTestnet;
		// case 167004:
		// 	return "taiko-aplha-2-testnet";
		case 84531:
			return baseGoerli;
		case 8453:
			return base;
		case 420:
			return optimismGoerli;
	}
	
}

const scroll = /*#__PURE__*/ defineChain({
	id: 534_352,
	name: 'Scroll',
	network: 'scroll',
	nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
	rpcUrls: {
	  default: {
		http: ['https://rpc.scroll.io'],
		webSocket: ['wss://wss-rpc.scroll.io/ws'],
	  },
	  public: {
		http: ['https://rpc.scroll.io'],
		webSocket: ['wss://wss-rpc.scroll.io/ws'],
	  },
	},
	blockExplorers: {
	  default: {
		name: 'Scrollscan',
		url: 'https://scrollscan.com',
	  },
	  blockscout: {
		name: 'Blockscout',
		url: 'https://blockscout.scroll.io',
	  },
	},
	contracts: {
	  multicall3: {
		address: '0xca11bde05977b3631167028862be2a173976ca11',
		blockCreated: 14,
	  },
	},
	testnet: false,
  })