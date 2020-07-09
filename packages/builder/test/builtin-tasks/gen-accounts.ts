import { assert } from "chai";
import * as fs from "fs";
import fse from "fs-extra";
import YAML from "yaml";

import { useFixtureProjectCopy } from "../helpers/project";
import { ASSETS_DIR } from "../../src/internal/core/project-structure";
import { mkAccounts, genAccounts, getFilename, Acc } from "../../src/builtin-tasks/gen-accounts";
import { AlgobRuntimeEnv } from "../../src/types";
import { getFixtureProjectPath } from "../helpers/project";

// function assertCleanBehavior() {
//   it("Should delete the folders if present", async function () {
//     await this.env.run(TASK_CLEAN);

//     assert.isFalse(fs.existsSync("./cache"));
//     assert.isFalse(fs.existsSync("./artifacts"));
//   });
// }

describe("Gen-accounts task", () => {
  useFixtureProjectCopy("default-config-project");

  it("genAccounts should generate n accounts", ()=>{
    const n = 4;
    const as = genAccounts(n);
    assert.lengthOf(as, n);
    for (let a of as){
      assert.typeOf(a.addr, "string");
      assert.lengthOf(a.addr, 58);
      assert.lengthOf(a.mnemonic.split(' '), 25);
    }
  });

  describe("accounts_generated.yaml flow", ()=>{


    it("Should fail when n is negative or 0", async () =>{
      try {
        await mkAccounts({n: 0}, {} as AlgobRuntimeEnv);
        assert.fail("should fail when n==0");
      } catch {}

      try {
        await mkAccounts({n: -1}, {} as AlgobRuntimeEnv);
        assert.fail("should fail when n==0");
      } catch {}
    });

    it("Should ensure test preconditions", () => {
      assert.isFalse(
        fs.existsSync(ASSETS_DIR),
        "assets directory shouldn't be created when task params are invalid");
    });


    let accounts: Acc[] = [];
    const filename = getFilename();

    it("should create a directory and a file", async ()=>{
      const n = 2;
      await mkAccounts({n}, {} as AlgobRuntimeEnv);

      const content = fs.readFileSync(filename, 'utf8');
      accounts = YAML.parse(content);
      assert.lengthOf(accounts, n);
    });

    it("should overwrite the accounts file only with --force flag", async ()=>{
      const n = 1;

      await mkAccounts({n}, {} as AlgobRuntimeEnv);
      let content = fs.readFileSync(filename, 'utf8');
      let accounts2 = YAML.parse(content) as Acc[];
      assert.deepEqual(accounts, accounts2);

      // now with --force flag
      await mkAccounts({force: true, n}, {} as AlgobRuntimeEnv);
      content = fs.readFileSync(filename, 'utf8');
      accounts2 = YAML.parse(content) as Acc[];
      assert.notDeepEqual(accounts2, accounts);
    });
  });
});
