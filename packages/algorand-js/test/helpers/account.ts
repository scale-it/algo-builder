import { assert } from "chai";

import { Runtime } from "../../src";
import { StoreAccount } from "../../src/types";

// returns account from runtime store (updated state)
export function getAcc (runtime: Runtime, acc: StoreAccount): StoreAccount {
  const account = runtime.ctx.state.accounts.get(acc.address);
  assert.isDefined(account);
  return account as StoreAccount;
}
