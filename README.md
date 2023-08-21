# Bastion SDK

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/yourusername/bastion-sdk/actions) [![Version](https://img.shields.io/npm/v/bastion-sdk)](https://www.npmjs.com/package/bastion-sdk) [![License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/yourusername/bastion-sdk/blob/main/LICENSE)

## Overview

Bastion is a modular, lightweight, and open-source account abstraction SDK designed to simplify the integration of decentralized wallet functionality into your applications. Written in TypeScript and fully ERC4337-compatible, Bastion ensures type safety while abstracting away the complexities of blockchain interactions.

With Bastion, you can provide a seamless multi-chain experience to your users. It allows secure storage of assets from different blockchains like Ethereum, Polygon, Optimism, Arbitrum, Scroll, and Taiko in a unified interface.

---

## Key Features

- 🌍 **Multi-Chain Support**: Out-of-the-box support for major Layer 1 and 2 chains. Easily expandable for additional chains.
- 🎛️ **Unified Accounts**: Manage accounts and keys across multiple chains using counterfactual addresses.
- 🛠️ **Developer-Friendly**: Abstraction of protocol differences means you don't need to be a blockchain expert.
- 🧩 **Modular Design**: Swap components like key management and data storage with ease.
- 🔒 **Advanced Features**: Built-in support for multi-signature wallets, social recovery, and more.
- 📦 **All-in-One**: Handles onboarding, transactions, NFTs, staking, messaging, and more.
- 🌟 **Open Source**: Full transparency with the ability to customize, audit, and extend.

---

## Installation

Install Bastion SDK using npm:

```bash
npm install bastion-sdk
```

Or with yarn:

```bash
yarn add bastion-sdk
```

---

## Quick Start

Here's a simple example to get you started:

```typescript
import { Bastion } from 'bastion-sdk';

const bastion = new Bastion();
const bastionConnect = await bastion.bastionConnect;

const CONFIG = {
	chainId: <chain_id>,
	privateKey: <your_private_key>,
	rpcUrl: <RPC_URL>,
};			
bastionConnect.init(<your_web3Provider>, CONFIG);
```

For more detailed examples, check the [Demo Examples](https://github.com/bastion-wallet/demo-examples) repo.

---

## Documentation

Check out the comprehensive [Documentation](https://link-to-documentation) for more in-depth tutorials, API references, and more.

---

## Contributing

We welcome contributions from the community. Please read our [Contributing Guide](/CONTRIBUTING.md) to get started.

---

## License

Bastion SDK is licensed under the [MIT License](/LICENSE).

---

## Support

For general questions, join our [Discord Channel](https://discord.gg/your-discord-link) or for issues and feature requests, please open an [issue](https://github.com/yourusername/bastion-sdk/issues).

---

Build the future of multi-chain crypto applications with Bastion today! 🚀
