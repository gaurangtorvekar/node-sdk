//This function returns the chain names based on their Chain ID
//You can find this reference here: https://docs.pimlico.io/reference/verifying-paymaster
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

