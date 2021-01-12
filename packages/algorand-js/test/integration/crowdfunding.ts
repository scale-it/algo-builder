import { addressToBytes, intToBigEndian } from "@algorand-builder/algob";
import { SSCDeploymentFlags } from "@algorand-builder/algob/src/types";
import { decodeAddress } from "algosdk";
import { assert } from "chai";

import { ERRORS } from "../../src/errors/errors-list";
import { Runtime, StoreAccount } from "../../src/index";
import { stringToBytes } from "../../src/lib/parsing";
import { expectTealErrorAsync } from "../helpers/errors";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

describe("Crowdfunding basic tests", function () {
  useFixture("stateful");
  const john = new StoreAccount(1000);

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
      addressToBytes(john.address),
      intToBigEndian(fundCloseDate.getTime())
    ];

    const appId = await runtime.addApp({ ...validFlags, appArgs: appArgs }, {}, program);
    const getGlobal = (key: string):
      bigint | Uint8Array |undefined => runtime.getGlobalState(appId, stringToBytes(key));
    const johnPk = decodeAddress(john.address).publicKey;

    // verify global state
    assert.isDefined(appId);
    assert.deepEqual(getGlobal('Creator'), johnPk);
    assert.deepEqual(getGlobal('StartDate'), BigInt(beginDate.getTime()));
    assert.deepEqual(getGlobal('EndDate'), BigInt(endDate.getTime()));
    assert.deepEqual(getGlobal('Goal'), 7000000n);
    assert.deepEqual(getGlobal('Receiver'), johnPk);
    assert.deepEqual(getGlobal('Total'), 0n);
  });
});
