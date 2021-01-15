import { assert } from "chai";

import { Runtime } from "../../src";
import { StoreAccountI } from "../../src/types";

// returns account from runtime store (updated state)
export function getAcc (runtime: Runtime, acc: StoreAccountI): StoreAccountI {
  const account = runtime.ctx.state.accounts.get(acc.address);
  assert.isDefined(account);
  return account as StoreAccountI;
}
