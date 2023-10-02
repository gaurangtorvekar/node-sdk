# Bastion Wallet SDK

[![Version](https://img.shields.io/npm/v/bastion-wallet-sdk)](https://www.npmjs.com/package/bastion-wallet-sdk) [![License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/bastion-wallet/sdk/blob/main/LICENSE)

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

Install Bastion Wallet SDK using npm:

```bash
npm install bastion-wallet-sdk
```

Or with yarn:

```bash
yarn add bastion-wallet-sdk
```

---

## Quick Start

Here's a simple example to get you started:

```typescript
import { Bastion } from 'bastion-wallet-sdk';

const bastion = new Bastion();
const bastionConnect = await bastion.bastionConnect;

const CONFIG = {
	apiKey: <bastion_api_key>
};
bastionConnect.init(<your_web3Provider>, CONFIG);
```

For detailed examples on how to use the SDK, check the [NextJS Demo App](https://github.com/bastion-wallet/nextjs-demo-app) starter template repo.

---

## Documentation

Check out the comprehensive [Documentation](https://docs.bastionwallet.io) for more in-depth tutorials, API references, and more.

---

## Contributing

We welcome contributions from the community. Please read our [Contributing Guide](/CONTRIBUTING.md) to get started.

---

## License

Bastion SDK is licensed under the [MIT License](/LICENSE).

---

## Support

For general questions, you can reach out to us at info@indorse.io.

---

Build the future of multi-chain crypto applications with Bastion today! 🚀

