import { SdkAccount } from "algorand-js/src/types";
import type { Account, AccountAssetInfo, AppLocalState, CreatedApps, CreatedAssets, SSCSchemaConfig } from "algosdk";
import { generateAccount } from "algosdk";

export class SdkAccountImpl implements SdkAccount {
  readonly account: Account;
  readonly address: string;
  assets: AccountAssetInfo[];
  amount: number;
  appsLocalState: AppLocalState[];
  appsTotalSchema: SSCSchemaConfig;
  createdApps: CreatedApps[];
  createdAssets: any[];

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
    this.appsLocalState = [];
    this.appsTotalSchema = <SSCSchemaConfig>{};
    this.createdApps = [];
    this.createdAssets = [];
  }

  balance (): number {
    return this.amount;
  }
}
