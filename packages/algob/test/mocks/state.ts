import type { Account, AccountAssetInfo } from "algosdk";
import { generateAccount } from "algosdk";

export class MockAccount {
  readonly account: Account;
  readonly address: string;
  assets: AccountAssetInfo[];
  amount: number;
  "amount-without-pending-rewards": number;
  'pending-rewards': number;
  'reward-base': number;
  rewards: number;
  round: number;
  status: string;
  'apps-local-state': any;
  'apps-total-schema': any;
  'created-apps': any;
  'created-assets': any;

  constructor (balance: number, account?: Account) {
    if (account) {
      // set config if account is passed by user
      this.account = account;
      this.address = account.addr;
    } else {
      // generate new account if not passed by user
      this.account = generateAccount();
      this.address = this.account.addr;
    }

    this.assets = [];
    this.amount = balance;
    this.rewards = 0;
    this.round = 0;
    this.status = 'Offline';
  }

  balance (): number {
    return this.amount;
  }
}
