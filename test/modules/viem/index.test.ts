import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { SmartWallet } from "../../../src/modules/smart-wallet";
import { Bastion } from "../../../src/index";
import { describe, beforeEach, it, expect } from "@jest/globals";
import { skip } from "node:test";
import { ERC721_ABI } from "../../utils/ERC721_ABI";
import {polygonMumbai} from 'viem/chains'
 
let smartWallet: SmartWallet;
let client;
let provider;
let BastionSampleNFT = "0xb390e253e43171a11a6afcb04e340fde5ae1b0a1";



const setup = () => {
    const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);
    const client = createWalletClient({account,
         chain: polygonMumbai, 
        transport : http(process.env.RPC_URL_MUM)})

	return client;
};

describe("setupSmartAccount", ()=> {
    beforeEach(() => {
		smartWallet = new SmartWallet();
		client = setup();
	});

    it.skip("should call a Smart Contract function gasless for ERC20 gas", async () => {
		let bastion = new Bastion();
		const BastionViem = await bastion.viem;

		//Pass along a gasToken to use for gas
		const gasToken = "DAI";
		await BastionViem.init(provider);

		const contractAddress = "0xEAC57C1413A2308cd03eF3CEa5c9224487825341";
		const contractABI = ["function safeMint(address to) public", "function balanceOf(address owner) external view returns (uint256 balance)"];

	

		const res = true
	}, 70000);

})

