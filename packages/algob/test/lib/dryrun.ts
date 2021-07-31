import { types } from '@algo-builder/web';
import { ExecParams } from "@algo-builder/web/src/types";
import algosdk, { generateAccount } from "algosdk";
import { assert } from "chai";
import * as fs from "fs";
import { pathExistsSync } from "fs-extra";
import * as path from "path";
import sinon from 'sinon';

import { ExecutionMode } from "../../../runtime/src/types";
import { Tealdbg } from "../../src";
import { ASSETS_DIR } from "../../src/internal/core/project-structure";
import { DeployerRunMode } from "../../src/internal/deployer";
import { DeployerConfig } from "../../src/internal/deployer_cfg";
import { Deployer } from "../../src/types";
import { mkEnv } from "../helpers/params";
import { useFixtureProject } from "../helpers/project";
import { mockAccountInformation, mockApplicationResponse, mockDryRunResponse, mockLsig, mockSuggestedParam } from "../mocks/tx";
import { AlgoOperatorDryRunImpl } from "../stubs/algo-operator";

class TealDbgMock extends Tealdbg {
  debugArgs = {};
  writtenFiles = [] as string[];

  async runDebugger (tealdbgArgs: string[]): Promise<boolean> {
    this.debugArgs = tealdbgArgs; // to test
    return true;
  }

  writeFile (filename: string, _content: Uint8Array): void {
    this.writtenFiles.push(filename);
    super.writeFile(filename, _content);
  }
}

describe("Debugging TEAL code using tealdbg", () => {
  useFixtureProject("config-project");
  let deployer: Deployer;
  let algod: AlgoOperatorDryRunImpl;
  let txnParam: ExecParams;
  let tealDebugger: TealDbgMock;

  beforeEach(async () => {
    const env = mkEnv("network1");
    algod = new AlgoOperatorDryRunImpl();
    const deployerCfg = new DeployerConfig(env, algod);
    deployer = new DeployerRunMode(deployerCfg);
    sinon.stub(algod.algodClient, "getTransactionParams")
      .returns({ do: async () => mockSuggestedParam } as ReturnType<algosdk.Algodv2['getTransactionParams']>);

    (sinon.stub(algod.algodClient, "dryrun") as any)
      .returns({ do: async () => mockDryRunResponse }) as ReturnType<algosdk.Algodv2['dryrun']>;

    (sinon.stub(algod.algodClient, "accountInformation") as any)
      .returns({ do: async () => mockAccountInformation }) as ReturnType<algosdk.Algodv2['accountInformation']>;

    (sinon.stub(algod.algodClient, "getApplicationByID") as any)
      .returns({ do: async () => mockApplicationResponse }) as ReturnType<algosdk.Algodv2['getApplicationByID']>;

    txnParam = {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: generateAccount().addr,
      toAccountAddr: generateAccount().addr,
      amount: 500,
      assetID: 1,
      lsig: mockLsig,
      payFlags: { totalFee: 1000 }
    };
    tealDebugger = new TealDbgMock(deployer, txnParam);
  });

  afterEach(async () => {
    (algod.algodClient.getTransactionParams as sinon.SinonStub).restore();
    (algod.algodClient.dryrun as sinon.SinonStub).restore();
    (algod.algodClient.accountInformation as sinon.SinonStub).restore();
    (algod.algodClient.getApplicationByID as sinon.SinonStub).restore();
  });

  it("dump dryrunResponse in assets/<file>", async () => {
    const resp = await tealDebugger.dryRunResponse();

    // assert recieved response
    assert.deepEqual(resp, mockDryRunResponse);

    // dump response to  file in assets
    await tealDebugger.dryRunResponse('dryrun-resp.json');

    // verify path and data
    const outPath = path.join(process.cwd(), ASSETS_DIR, 'dryrun-resp.json');
    assert.isTrue(pathExistsSync(outPath));
    const data = fs.readFileSync(outPath);
    assert.deepEqual(JSON.parse(Buffer.from(data).toString()), mockDryRunResponse);

    fs.rmSync(outPath);
  });

  it("should warn or overwrite existing dryRunResponse based on --force flag", async () => {
    const stub = console.error as sinon.SinonStub;
    stub.reset();

    await tealDebugger.dryRunResponse('response.json');
    await tealDebugger.dryRunResponse('response.json'); // running again with same outfile

    const warnMsg =
      'File assets/response.json already exists. Aborting. Use --force flag if you want to overwrite it';
    assert.isTrue(stub.calledWith(warnMsg));

    // if --force == true is passed then file is overwritten
    await tealDebugger.dryRunResponse('response.json', true);
    assert.isTrue((console.log as sinon.SinonStub)
      .calledWith(`Data written succesfully to assets/response.json`));

    fs.rmSync(path.join(process.cwd(), ASSETS_DIR, 'response.json'));
  });

  it("should write --dryrun-dump in `cache/dryrun` and run debugger with provided args", async () => {
    assert.equal(tealDebugger.writtenFiles.length, 0);
    await tealDebugger.run();

    // verify .msdp (dryrun dump) is present in cache/dryrun
    assert.equal(tealDebugger.writtenFiles.length, 1);
    // eg. artifacts/cache/dryrun/dump-1626204870.msgp
    const pathToMsgpDump = tealDebugger.writtenFiles[0];
    assert.equal(path.dirname(pathToMsgpDump), 'artifacts/cache/dryrun');

    // verify dump arg (-d)
    assert.include(tealDebugger.debugArgs, '-d');
    assert.include(tealDebugger.debugArgs, pathToMsgpDump);

    // verify path to teal file is present(if passed)
    await tealDebugger.run({ tealFile: 'gold-asa.teal' });
    assert.include(tealDebugger.debugArgs, 'assets/gold-asa.teal');

    // verify mode and groupIndex arg (--mode, --group-index)
    await tealDebugger.run({ mode: ExecutionMode.APPLICATION, groupIndex: 0 });
    assert.include(tealDebugger.debugArgs, '--mode');
    assert.include(tealDebugger.debugArgs, 'application');
    assert.include(tealDebugger.debugArgs, '--group-index');
    assert.include(tealDebugger.debugArgs, '0');
  });

  it("should throw error if groupIndex is greator than txGroup length", async () => {
    tealDebugger.execParams = [txnParam, { ...txnParam, payFlags: { note: 'Algrand' } }];

    try {
      await tealDebugger.run({ mode: ExecutionMode.APPLICATION, groupIndex: 5 });
    } catch (error) {
      assert.equal(error.message, 'groupIndex(= 5) exceeds transaction group length(= 2)');
    }
  });

  it("should run debugger using pyteal files as well", async () => {
    const writtenFilesBeforeLen = tealDebugger.writtenFiles.length;
    await tealDebugger.run({ tealFile: 'gold-asa.py' });

    // 2 files should be written: (1. --dryrun-dump and 2. compiled teal code from pyTEAL)
    assert.equal(tealDebugger.writtenFiles.length, writtenFilesBeforeLen + 2);
  });
});
