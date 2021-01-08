import { addressToBytes, intToBigEndian } from "@algorand-builder/algob";
import { SSCDeploymentFlags } from "@algorand-builder/algob/src/types";
import { decodeAddress } from "algosdk";
import { assert } from "chai";

import { ERRORS } from "../../src/errors/errors-list";
import { Runtime, StoreAccountImpl } from "../../src/index";
import { base64ToBytes } from "../../src/lib/parsing";
import { expectTealErrorAsync } from "../helpers/errors";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

describe("Crowdfunding basic tests", function () {
  useFixture("stateful");
  const john = new StoreAccountImpl(1000);

  let runtime: Runtime;
  let program: string;
  let flags: SSCDeploymentFlags;
  this.beforeAll(async function () {
    runtime = new Runtime([john]); // setup test
    program = getProgram('crowdfunding.teal');

    flags = {
      sender: john.account,
      globalBytes: 32,
      globalInts: 32,
      localBytes: 8,
      localInts: 8
    };
  });

  it("should fail during create application if 0 args are passed", async function () {
    // create new app
    await expectTealErrorAsync(
      async () => await runtime.addApp(flags, {}, program),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should create application and update global state if correct args are passed", async function () {
    const validFlags: SSCDeploymentFlags = Object.assign({}, flags);

    // Get begin date to pass in
    const beginDate = new Date();
    beginDate.setSeconds(beginDate.getSeconds() + 2);

    // Get end date to pass in
    const endDate = new Date();
    endDate.setSeconds(endDate.getSeconds() + 12000);

    // Get fund close date to pass in
    const fundCloseDate = new Date();
    fundCloseDate.setSeconds(fundCloseDate.getSeconds() + 120000);

    const appArgs = [
      intToBigEndian(beginDate.getTime()),
      intToBigEndian(endDate.getTime()),
      intToBigEndian(7000000),
      addressToBytes(john.account.addr),
      intToBigEndian(fundCloseDate.getTime())
    ];

    const appId = await runtime.addApp({ ...validFlags, appArgs: appArgs }, {}, program);
    const johnPk = decodeAddress(john.account.addr).publicKey;

    // verify global state
    assert.isDefined(appId);
    assert.deepEqual(runtime.getGlobalState(appId, base64ToBytes('Creator')), johnPk);
    assert.deepEqual(runtime.getGlobalState(appId, base64ToBytes('StartDate')), BigInt(beginDate.getTime()));
    assert.deepEqual(runtime.getGlobalState(appId, base64ToBytes('EndDate')), BigInt(endDate.getTime()));
    assert.deepEqual(runtime.getGlobalState(appId, base64ToBytes('Goal')), 7000000n);
    assert.deepEqual(runtime.getGlobalState(appId, base64ToBytes('Receiver')), johnPk);
    assert.deepEqual(runtime.getGlobalState(appId, base64ToBytes('Total')), 0n);
  });
});
