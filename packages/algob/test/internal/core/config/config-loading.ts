import { types as rtypes } from "@algo-builder/runtime";
import { Kmd } from "algosdk";
import { assert } from "chai";
import path from "path";
import sinon from 'sinon';

import {
  TASK_CLEAN,
  TASK_CONSOLE,
  TASK_HELP,
  TASK_INIT,
  TASK_RUN,
  TASK_TEST
} from "../../../../src/builtin-tasks/task-names";
import { ERRORS } from "../../../../src/errors/errors-list";
import { BuilderContext } from "../../../../src/internal/context";
import { loadConfigAndTasks, loadKMDAccounts } from "../../../../src/internal/core/config/config-loading";
import { resetBuilderContext } from "../../../../src/internal/reset";
import { KMDOperator } from "../../../../src/lib/account";
import { createKmdClient } from "../../../../src/lib/driver";
import { KmdCfg, NetworkConfig } from "../../../../src/types";
import { assertAccountsEqual } from "../../../helpers/assert-methods";
import { useEnvironment } from "../../../helpers/environment";
import { expectBuilderErrorAsync } from "../../../helpers/errors";
import {
  getFixtureProjectPath,
  useFixtureProject
} from "../../../helpers/project";
import { account1 } from "../../../mocks/account";

class KMDOperatorMock extends KMDOperator {
  accounts = [] as rtypes.Account[];
  skArray = Array.from({ length: 64 }, (_, i) => i + 1);

  resetAccounts (): void {
    this.accounts = [];
  }

  addKmdAccount (acc: rtypes.Account): void {
    this.accounts.push(acc);
  }

  async loadKMDAccounts (_kcfg: KmdCfg): Promise<rtypes.Account[]> {
    return this.accounts;
  }
}

describe("config loading", function () {
  describe("default config path", function () {
    useFixtureProject("config-project");
    useEnvironment();

    it("should load the default config if none is given", function () {
      const a: any = this.env.config.networks;
      assert.isDefined(a.localhost);
      assertAccountsEqual(a.localhost.accounts, [account1]);
    });
  });

  describe("Config validation", function () {
    describe("When the config is invalid", function () {
      useFixtureProject("invalid-config");

      beforeEach(function () {
        BuilderContext.createBuilderContext();
      });

      afterEach(function () {
        resetBuilderContext();
      });

      it("Should throw the right error", function () {
        expectBuilderErrorAsync(
          () => loadConfigAndTasks(),
          ERRORS.GENERAL.INVALID_CONFIG
        ).catch((err) => console.log(err));
      });
    });
  });

  describe("custom config path", function () {
    useFixtureProject("custom-config-file");

    beforeEach(function () {
      BuilderContext.createBuilderContext();
    });

    afterEach(function () {
      resetBuilderContext();
    });

    it("should accept a relative path from the CWD", async function () {
      const config = await loadConfigAndTasks({ config: "config.js" });

      if (!config.paths) {
        assert.fail("Project was not loaded");
      }

      assert.equal(
        config.paths.configFile,
        path.normalize(path.join(process.cwd(), "config.js"))
      );
    });

    it("should accept an absolute path", async function () {
      const fixtureDir = getFixtureProjectPath("custom-config-file");
      const config = await loadConfigAndTasks({
        config: path.join(fixtureDir, "config.js")
      });

      if (!config.paths) {
        assert.fail("Project was not loaded");
      }

      assert.equal(
        config.paths.configFile,
        path.normalize(path.join(process.cwd(), "config.js"))
      );
    });
  });

  describe("Tasks loading", function () {
    useFixtureProject("config-project");
    useEnvironment();

    it("Should define the default tasks", function () {
      assert.containsAllKeys(this.env.tasks, [
        TASK_CLEAN,
        TASK_RUN,
        TASK_INIT,
        TASK_CONSOLE,
        TASK_HELP,
        TASK_TEST
      ]);
    });

    it("Should load custom tasks", function () {
      assert.containsAllKeys(this.env.tasks, ["example"]);
    });
  });

  describe("Config env", function () {
    useFixtureProject("config-project");

    afterEach(function () {
      resetBuilderContext();
    });

    it("should remove everything from global state after loading", async function () {
      const globalAsAny: any = global;

      BuilderContext.createBuilderContext();
      await loadConfigAndTasks();

      assert.isUndefined(globalAsAny.internalTask);
      assert.isUndefined(globalAsAny.task);
      assert.isUndefined(globalAsAny.types);
      assert.isUndefined(globalAsAny.extendEnvironment);
      assert.isUndefined(globalAsAny.usePlugin);

      resetBuilderContext();

      BuilderContext.createBuilderContext();
      await loadConfigAndTasks();

      assert.isUndefined(globalAsAny.internalTask);
      assert.isUndefined(globalAsAny.task);
      assert.isUndefined(globalAsAny.types);
      assert.isUndefined(globalAsAny.extendEnvironment);
      assert.isUndefined(globalAsAny.usePlugin);
      resetBuilderContext();
    });
  });

  describe("load kmd accounts", function () {
    useFixtureProject("config-project");
    useEnvironment();

    const fakeKmd: Kmd = {} as Kmd; // eslint-disable-line @typescript-eslint/consistent-type-assertions
    const kmdOp = new KMDOperatorMock(fakeKmd);
    let net: NetworkConfig;

    beforeEach(function () {
      net = this.env.config.networks.kmdNet;
    });

    afterEach(function () {
      kmdOp.resetAccounts();
    });

    it("should ignore if kmd config is not defined", async function () {
      net.kmdCfg = undefined;
      const result = await loadKMDAccounts(net, kmdOp);
      assert.isUndefined(result);
    });

    it("should not connect to kmd if config is invalid", async function () {
      const invalidKmdCfg = net.kmdCfg as KmdCfg;
      invalidKmdCfg.port = 123; // invalid port

      expectBuilderErrorAsync(
        () => loadKMDAccounts(net, new KMDOperator(createKmdClient(invalidKmdCfg))),
        ERRORS.KMD.CONNECTION
      ).catch((err) => console.log(err)); ;
    });

    it("should detect conflict of account names", async function () {
      // console is mocked in package.json mocha options
      const stub = console.warn as sinon.SinonStub;
      stub.reset();

      kmdOp.addKmdAccount({ name: net.accounts[0].name, addr: "some-addr-1", sk: new Uint8Array(kmdOp.skArray) });
      await loadKMDAccounts(net, kmdOp);

      assert(stub.calledWith(
        "KMD account name conflict: KmdConfig and network.accounts both define an account with same name: "));
    });

    it("network accounts should take precedence over KMD accounts", async function () {
      const networkAcc = net.accounts[0];
      const commonName = networkAcc.name;

      // insert kmd account with same name but different address
      const kmdAcc = {
        name: commonName,
        addr: 'some-different-addr',
        sk: new Uint8Array(kmdOp.skArray)
      };
      kmdOp.addKmdAccount(kmdAcc);
      await loadKMDAccounts(net, kmdOp);

      assert.notInclude(net.accounts, kmdAcc); // network.accounts should not include kmd account with same name
      assert.include(net.accounts, networkAcc); // network.accounts should include networkAcc (higher precendence)
    });

    it("kmd accounts with different names should be successfully merged", async function () {
      kmdOp.addKmdAccount({ name: "some-different-name-1", addr: "some-addr-1", sk: new Uint8Array(kmdOp.skArray) });
      kmdOp.addKmdAccount({ name: "some-different-name-2", addr: "some-addr-2", sk: new Uint8Array(kmdOp.skArray) });

      await loadKMDAccounts(net, kmdOp);

      for (const k of kmdOp.accounts) {
        assert.include(net.accounts, k); // assert if kmd accounts are merged into network.accounts
      }
    });

    it("private keys are correctly loaded", async function () {
      kmdOp.addKmdAccount({ name: "some-name", addr: "some-addr", sk: new Uint8Array(kmdOp.skArray) });
      await loadKMDAccounts(net, kmdOp);

      for (const a of net.accounts) {
        assert.isDefined(a.sk);
        assert.typeOf(a.sk, 'Uint8Array');
      }
    });
  });
});
