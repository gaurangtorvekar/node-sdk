//This function returns the chain names based on their Chain ID
//You can find this reference here: https://docs.pimlico.io/reference/verifying-paymaster
export const getChainName = async (chainId) => {
	switch (chainId) {
		case 80001:
			return "mumbai";
		case 421613:
			return "arbitrum-goerli";
	}
};

