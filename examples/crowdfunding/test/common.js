import { assert } from 'chai';

// returns account from runtime store (updated state)
export function getAcc (runtime, acc) {
  const account = runtime.ctx.state.accounts.get(acc.address);
  assert.isDefined(account);
  return account;
}
