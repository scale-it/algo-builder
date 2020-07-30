import { assert } from "chai";

import type { Account } from "algosdk";

export function assertAccountsEqual(ls1: Account[], ls2: Account[]) {
  assert.equal(ls1.length, ls2.length, "account lists must have same length");
  for (let i=0; i<ls1.length; ++i){
    const a1 = ls1[i];
    const a2 = ls2[i];
    assert.equal(a1.addr, a2.addr, "addresses must equal");
    // for some reason a1.sk is a proxy object and we can't easily compare it.
    for (let j=0; j<64; ++j)
      assert.equal(a1.sk[j], a2.sk[j], "secret key must equal");
  }
}
