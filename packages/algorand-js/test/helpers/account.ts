import { Runtime } from "../../src";
import { StoreAccount } from "../../src/types";

// returns account from runtime store (updated state)
export function getAcc (runtime: Runtime, acc: StoreAccount): StoreAccount {
  const account = runtime.ctx.state.accounts.get(acc.address);
  if (account === undefined) {
    throw new Error(`Account ${acc.address} does not exist in runtime store.
Most probably it wasn't passed during runtime intialization`);
  }
  return account;
}
