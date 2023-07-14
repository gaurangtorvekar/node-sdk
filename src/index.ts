import { SmartWallet } from './modules/smart-wallet';

export class Bastion {
  smartWallet: SmartWallet;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.smartWallet = new SmartWallet(config);
  }
}
