import { types as rtypes } from "@algo-builder/runtime";
import { ERRORS, types as wtypes } from "@algo-builder/web";
import { AlgoTransferParam, SignType, TransactionType } from "@algo-builder/web/build/types";
import algosdk, { generateAccount, LogicSigAccount, Transaction } from "algosdk";
import { assert } from "chai";

import { genAccounts } from "../../src/builtin-tasks/gen-accounts";
import { DeployerDeployMode } from "../../src/internal/deployer";
import { DeployerConfig } from "../../src/internal/deployer_cfg";
import { getDummyLsig } from "../../src/lib/lsig";
import { CheckpointRepoImpl } from "../../src/lib/script-checkpoints";
import { Checkpoints, LsigInfo } from "../../src/types";
import { expectBuilderError, expectBuilderErrorAsync } from "../helpers/errors";
import { mkEnv } from "../helpers/params";
import { useFixtureProject } from "../helpers/project";
import { cleanupMutableData } from "../lib/script-checkpoints";
import { MOCK_APPLICATION_ADDRESS, mockSuggestedParam } from "../mocks/tx";
import { AlgoOperatorDryRunImpl } from "../stubs/algo-operator";

function mkASA(): wtypes.ASADef {
	return {
		total: 1,
		decimals: 1,
		unitName: "ASA",
		defaultFrozen: false,
		clawback: undefined,
		freeze: undefined,
		manager: undefined,
		reserve: undefined,
	};
}

describe("DeployerDeployMode", function () {
	useFixtureProject("config-project");
	let deployerCfg: DeployerConfig, env;
	const mp = new Map<number, rtypes.AppInfo>();

	beforeEach(function () {
		env = mkEnv("network 123");
		deployerCfg = new DeployerConfig(env, new AlgoOperatorDryRunImpl());
		deployerCfg.asaDefs = {};
		deployerCfg.accounts = new Map();
		deployerCfg.cpData = new CheckpointRepoImpl();
	});

	it("Should ensure metadata existence for network", async function () {
		const cpData = new CheckpointRepoImpl().putMetadata("network 123", "k", "v");
		assert.deepEqual(cleanupMutableData(cpData.precedingCP["network 123"], 12345), {
			timestamp: 12345,
			metadata: new Map([["k", "v"]]),
			asa: new Map<string, rtypes.ASAInfo>(),
			app: new Map<string, typeof mp>(),
			dLsig: new Map<string, LsigInfo>(),
		});
	});

	it("Should hold metadata of a network", async function () {
		const deployer = new DeployerDeployMode(deployerCfg);
		deployer.addCheckpointKV("existent", "existent value");
		assert.isUndefined(deployer.getCheckpointKV("nonexistent"));
		assert.equal(deployer.getCheckpointKV("existent"), "existent value");
	});

	it("Should set given data into checkpoint with timestamp", async function () {
		const deployer = new DeployerDeployMode(deployerCfg);
		deployer.addCheckpointKV("key 1", "val 1");
		deployer.addCheckpointKV("key 2", "val 2");
		const cleanCP = cleanupMutableData(deployerCfg.cpData.precedingCP["network 123"], 12345);
		assert.deepEqual(cleanCP, {
			timestamp: 12345,
			metadata: new Map([
				["key 1", "val 1"],
				["key 2", "val 2"],
			]),
			asa: new Map<string, rtypes.ASAInfo>(),
			app: new Map<string, typeof mp>(),
			dLsig: new Map<string, LsigInfo>(),
		});
	});

	it("Should append freshly loaded checkpoint values", async function () {
		const cp1: Checkpoints = {
			network1: {
				timestamp: 1,
				metadata: new Map([["key 1", "data 1"]]),
				asa: new Map<string, rtypes.ASAInfo>(),
				app: new Map<string, typeof mp>(),
				dLsig: new Map<string, LsigInfo>(),
			},
		};
		const cp2: Checkpoints = {
			network2: {
				timestamp: 2,
				metadata: new Map([["key 2", "data 2"]]),
				asa: new Map<string, rtypes.ASAInfo>(),
				app: new Map<string, typeof mp>(),
				dLsig: new Map<string, LsigInfo>(),
			},
		};
		const cpData = new CheckpointRepoImpl();
		cpData.merge(cp1, "12s");
		cpData.merge(cp2, "12s");
		assert.deepEqual(cpData.precedingCP, {
			network1: {
				timestamp: 1,
				metadata: new Map([["key 1", "data 1"]]),
				asa: new Map<string, rtypes.ASAInfo>(),
				app: new Map<string, typeof mp>(),
				dLsig: new Map<string, LsigInfo>(),
			},
			network2: {
				timestamp: 2,
				metadata: new Map([["key 2", "data 2"]]),
				asa: new Map<string, rtypes.ASAInfo>(),
				app: new Map<string, typeof mp>(),
				dLsig: new Map<string, LsigInfo>(),
			},
		});
	});

	it("Should save info to checkpoint after asset deployment", async function () {
		const env = mkEnv("network1");
		const deployerCfg = new DeployerConfig(env, new AlgoOperatorDryRunImpl());
		deployerCfg.asaDefs = { MY_ASA: mkASA() };
		const deployer = new DeployerDeployMode(deployerCfg);

		const asaInfo = await deployer.deployASA("MY_ASA", { creator: deployer.accounts[0] });
		assert.deepEqual(asaInfo, {
			creator: "addr-1-get-address-dry-run",
			txID: "tx-id-dry-run",
			confirmedRound: -1,
			assetIndex: 1,
			assetDef: mkASA(),
			deleted: false,
		});

		deployerCfg.cpData.precedingCP.network1.timestamp = 515236;
		assert.deepEqual(deployerCfg.cpData.precedingCP, {
			network1: {
				asa: new Map([
					[
						"MY_ASA",
						{
							creator: "addr-1-get-address-dry-run",
							txID: "tx-id-dry-run",
							confirmedRound: -1,
							assetIndex: 1,
							assetDef: mkASA(),
							deleted: false,
						},
					],
				]),
				app: new Map(),
				dLsig: new Map(),
				metadata: new Map<string, string>(),
				timestamp: 515236,
			},
		});
	});

	it("Should save info to checkpoint after SSC deployment", async function () {
		const env = mkEnv("network1");
		const deployerCfg = new DeployerConfig(env, new AlgoOperatorDryRunImpl());
		const deployer = new DeployerDeployMode(deployerCfg);
		const nestedMap = new Map<number, rtypes.AppInfo>();
		nestedMap.set(1, {
			creator: "addr-1-get-address-dry-run",
			applicationAccount: MOCK_APPLICATION_ADDRESS,
			txID: "tx-id-dry-run",
			confirmedRound: -1,
			appID: 33,
			timestamp: 1,
			deleted: false,
			approvalFile: "approval-file.py",
			clearFile: "clear-file.py",
		});

		const sscInfo = await deployer.deployApp(
			deployer.accounts[0],
			{
				appName: "app-clear",
				metaType: wtypes.MetaType.FILE,
				approvalProgramFilename: "app.teal",
				clearProgramFilename: "clear.teal",
				localInts: 1,
				globalInts: 1,
				localBytes: 1,
				globalBytes: 1,
			},
			{}
		);
		assert.deepEqual(sscInfo, {
			creator: "addr-1-get-address-dry-run",
			applicationAccount: MOCK_APPLICATION_ADDRESS,
			txID: "tx-id-dry-run",
			confirmedRound: -1,
			appID: 33,
			timestamp: 1,
			deleted: false,
			approvalFile: "approval-file.py",
			clearFile: "clear-file.py",
		});

		deployerCfg.cpData.precedingCP.network1.timestamp = 515236;
		assert.deepEqual(deployerCfg.cpData.precedingCP, {
			network1: {
				asa: new Map(),
				app: new Map([["app-clear", nestedMap]]),
				dLsig: new Map(),
				metadata: new Map<string, string>(),
				timestamp: 515236,
			},
		});

		nestedMap.set(2, {
			creator: "addr-1-get-address-dry-run",
			applicationAccount: MOCK_APPLICATION_ADDRESS,
			txID: "tx-id-dry-run",
			confirmedRound: -1,
			appID: 33,
			timestamp: 2,
			deleted: false,
			approvalFile: "approval-file.py",
			clearFile: "clear-file.py",
		});

		const updatedInfo = await deployer.updateApp(
			"app-clear",
			deployer.accounts[0],
			{},
			33,
			{
				metaType: wtypes.MetaType.FILE,
				approvalProgramFilename: "app",
				clearProgramFilename: "clear",
			},
			{}
		);
		assert.deepEqual(updatedInfo, {
			creator: "addr-1-get-address-dry-run",
			applicationAccount: MOCK_APPLICATION_ADDRESS,
			txID: "tx-id-dry-run",
			confirmedRound: -1,
			appID: 33,
			timestamp: 2,
			deleted: false,
			approvalFile: "approval-file.py",
			clearFile: "clear-file.py",
		});

		// should create a nested checkpoint if name is same after update
		assert.deepEqual(deployerCfg.cpData.precedingCP, {
			network1: {
				asa: new Map(),
				app: new Map([["app-clear", nestedMap]]),
				dLsig: new Map(),
				metadata: new Map<string, string>(),
				timestamp: 515236,
			},
		});
	});

	it("Should save info by app name to checkpoint after App deployment if app name is passed", async function () {
		const env = mkEnv("network1");
		const deployerCfg = new DeployerConfig(env, new AlgoOperatorDryRunImpl());
		const deployer = new DeployerDeployMode(deployerCfg);
		const nestedMap = new Map<number, rtypes.AppInfo>();
		nestedMap.set(1, {
			creator: "addr-1-get-address-dry-run",
			applicationAccount: MOCK_APPLICATION_ADDRESS,
			txID: "tx-id-dry-run",
			confirmedRound: -1,
			appID: 33,
			timestamp: 1,
			deleted: false,
			approvalFile: "approval-file.py",
			clearFile: "clear-file.py",
		});

		const appDefinition: wtypes.AppDefinitionFromFile = {
			metaType: wtypes.MetaType.FILE,
			approvalProgramFilename: "app",
			clearProgramFilename: "clear",
			localInts: 1,
			globalInts: 1,
			localBytes: 1,
			globalBytes: 1,
			appName: "my-app",
		};

		const sscInfo = await deployer.deployApp(deployer.accounts[0], appDefinition, {});
		assert.deepEqual(sscInfo, {
			creator: "addr-1-get-address-dry-run",
			applicationAccount: MOCK_APPLICATION_ADDRESS,
			txID: "tx-id-dry-run",
			confirmedRound: -1,
			appID: 33,
			timestamp: 1,
			deleted: false,
			approvalFile: "approval-file.py",
			clearFile: "clear-file.py",
		});

		deployerCfg.cpData.precedingCP.network1.timestamp = 515236;
		assert.deepEqual(deployerCfg.cpData.precedingCP, {
			network1: {
				asa: new Map(),
				app: new Map([["my-app", nestedMap]]), // checkpoint created against "app name"
				dLsig: new Map(),
				metadata: new Map<string, string>(),
				timestamp: 515236,
			},
		});

		nestedMap.set(2, {
			creator: "addr-1-get-address-dry-run",
			applicationAccount: MOCK_APPLICATION_ADDRESS,
			txID: "tx-id-dry-run",
			confirmedRound: -1,
			appID: 33,
			timestamp: 2,
			deleted: false,
			approvalFile: "approval-file.py",
			clearFile: "clear-file.py",
		});

		const updatedInfo = await deployer.updateApp(
			"my-app",
			deployer.accounts[0],
			{},
			33,
			{
				metaType: wtypes.MetaType.FILE,
				approvalProgramFilename: "app",
				clearProgramFilename: "clear",
			},
			{},
			{}
		);
		assert.deepEqual(updatedInfo, {
			creator: "addr-1-get-address-dry-run",
			applicationAccount: MOCK_APPLICATION_ADDRESS,
			txID: "tx-id-dry-run",
			confirmedRound: -1,
			appID: 33,
			timestamp: 2,
			deleted: false,
			approvalFile: "approval-file.py",
			clearFile: "clear-file.py",
		});

		// should create a nested checkpoint if name is same after update
		assert.deepEqual(deployerCfg.cpData.precedingCP, {
			network1: {
				asa: new Map(),
				app: new Map([["my-app", nestedMap]]), // update app checkpoint created against "same app" name
				dLsig: new Map(),
				metadata: new Map<string, string>(),
				timestamp: 515236,
			},
		});
	});

	it("Should save overriden asaDef to checkpoint after asset deployment if custom ASA params are passed", async function () {
		const env = mkEnv("network1");
		const deployerCfg = new DeployerConfig(env, new AlgoOperatorDryRunImpl());
		const accounts = genAccounts(4);
		const fixedAccount = generateAccount();
		deployerCfg.asaDefs = {
			MY_ASA: {
				...mkASA(),
				manager: accounts[0].addr,
				reserve: accounts[1].addr,
				clawback: fixedAccount.addr,
				freeze: fixedAccount.addr,
			},
		};
		const deployer = new DeployerDeployMode(deployerCfg);

		// passing different manager & reserve address in customParams during ASA deploy
		const asaInfo = await deployer.deployASA(
			"MY_ASA",
			{ creator: deployer.accounts[0] },
			{
				manager: accounts[2].addr,
				reserve: accounts[3].addr,
			}
		);

		// manager, reserve should be overriden
		// clawback, freeze should be original one
		const expectedASADef = {
			...mkASA(),
			manager: accounts[2].addr,
			reserve: accounts[3].addr,
			clawback: fixedAccount.addr,
			freeze: fixedAccount.addr,
		};

		assert.deepEqual(asaInfo, {
			creator: "addr-1-get-address-dry-run",
			txID: "tx-id-dry-run",
			confirmedRound: -1,
			assetIndex: 1,
			assetDef: expectedASADef,
			deleted: false,
		});

		deployerCfg.cpData.precedingCP.network1.timestamp = 515236;
		assert.deepEqual(deployerCfg.cpData.precedingCP, {
			network1: {
				asa: new Map([
					[
						"MY_ASA",
						{
							creator: "addr-1-get-address-dry-run",
							txID: "tx-id-dry-run",
							confirmedRound: -1,
							assetIndex: 1,
							assetDef: expectedASADef,
							deleted: false,
						},
					],
				]),
				app: new Map(),
				dLsig: new Map(),
				metadata: new Map<string, string>(),
				timestamp: 515236,
			},
		});

		// after recreating deployer with the same config, assetDef should be expected (overriden) one
		const newDeployer = new DeployerDeployMode(deployerCfg);
		assert.deepEqual(newDeployer.asa.get("MY_ASA")?.assetDef, expectedASADef);
	});

	it("Should load delegated logic signature", async function () {
		const env = mkEnv("network1");
		const deployerCfg = new DeployerConfig(env, new AlgoOperatorDryRunImpl());
		deployerCfg.asaDefs = { MY_ASA: mkASA() };
		const deployer = new DeployerDeployMode(deployerCfg);

		const logicSig = getDummyLsig() as any;

		const cp1: Checkpoints = {
			network1: {
				timestamp: 1,
				metadata: new Map([["key 1", "data 1"]]),
				asa: new Map<string, rtypes.ASAInfo>(),
				app: new Map<string, typeof mp>(),
				dLsig: new Map<string, LsigInfo>([
					[
						"MY_LSIG",
						{
							creator: "addr-1-get-address-dry-run",
							contractAddress: "ASDFGDDSSS12A",
							lsig: logicSig,
						},
					],
				]),
			},
		};

		deployerCfg.cpData.merge(cp1, "12s");
		const result = deployer.getLsig("MY_LSIG");
		assert.deepEqual(logicSig, result);
	});

	it("Should use getCheckpointKV and isDefined from CheckpointData", async function () {
		const networkName = "network1";
		const env = mkEnv(networkName);
		const cpData = new CheckpointRepoImpl()
			.registerASA(networkName, "ASA name", {
				creator: "ASA creator 123",
				txID: "",
				confirmedRound: 0,
				assetIndex: 0,
				assetDef: {} as wtypes.ASADef,
				deleted: false,
			})
			.registerSSC(networkName, "ASC name", {
				creator: "ASC creator 951",
				applicationAccount: MOCK_APPLICATION_ADDRESS,
				txID: "",
				confirmedRound: 0,
				appID: -1,
				timestamp: 1,
				deleted: false,
				approvalFile: "approval-file.py",
				clearFile: "clear-file.py",
			})
			.registerLsig(networkName, "Lsig name", {
				creator: "Lsig creator",
				contractAddress: "addr-1",
				lsig: {} as LogicSigAccount,
			})
			.putMetadata(networkName, "k", "v");
		const deployerCfg = new DeployerConfig(env, new AlgoOperatorDryRunImpl());
		deployerCfg.cpData = cpData;
		const deployer = new DeployerDeployMode(deployerCfg);

		assert.isTrue(deployer.isDefined("ASC name"));
		assert.equal(deployer.getCheckpointKV("k"), "v");
	});

	it("Should ignore same metadata of the same network", async function () {
		const deployer = new DeployerDeployMode(deployerCfg);
		deployer.addCheckpointKV("existent", "existent value");
		deployer.addCheckpointKV("existent", "existent value");
		assert.equal(deployer.getCheckpointKV("existent"), "existent value");
	});

	it("Should crash when same metadata key is set second time & different value", async function () {
		const deployer = new DeployerDeployMode(deployerCfg);
		deployer.addCheckpointKV("metadata_key", "orig_value");
		expectBuilderError(
			() => deployer.addCheckpointKV("metadata_key", "new_value"),
			ERRORS.BUILTIN_TASKS.DEPLOYER_METADATA_ALREADY_PRESENT,
			"metadata_key"
		);
	});

	it("Should crash when same ASA name is tried to deploy to second time", async function () {
		deployerCfg.asaDefs = { ASA_key: mkASA() };
		const deployer = new DeployerDeployMode(deployerCfg);
		await deployer.deployASA("ASA_key", { creator: deployer.accounts[0] });
		await expectBuilderErrorAsync(
			async () => await deployer.deployASA("ASA_key", { creator: deployer.accounts[0] }),
			ERRORS.BUILTIN_TASKS.DEPLOYER_ASSET_ALREADY_PRESENT,
			"ASA_key"
		);
	});

	it("Should crash when ASA for given name doesn't exist", async function () {
		const deployer = new DeployerDeployMode(deployerCfg);
		await expectBuilderErrorAsync(
			async () => await deployer.deployASA("ASA_key", { creator: deployer.accounts[0] }),
			ERRORS.BUILTIN_TASKS.DEPLOYER_ASA_DEF_NOT_FOUND,
			"ASA_key"
		);
	});

	it("Should not crash when same ASC Contract Mode name is tried to fund second time", async function () {
		const deployer = new DeployerDeployMode(deployerCfg);
		await deployer.fundLsigByFile(
			"Lsig",
			{ funder: deployer.accounts[1], fundingMicroAlgo: 1000 },
			{}
		);
	});

	it("Should crash on fundLsig if lsig is not present in checkpoint", async function () {
		const deployer = new DeployerDeployMode(deployerCfg);
		await expectBuilderErrorAsync(
			async () =>
				await deployer.fundLsig(
					"AwesomeLsig",
					{ funder: deployer.accounts[1], fundingMicroAlgo: 1000 },
					{}
				),
			ERRORS.GENERAL.LSIG_NOT_FOUND_IN_CP,
			"Logic signature(name = AwesomeLsig) not found in checkpoint"
		);
	});

	it("Should not crash on fundLsig if lsig is present in checkpoint", async function () {
		const networkName = "network1";
		const env = mkEnv(networkName);
		const cpData = new CheckpointRepoImpl()
			.registerLsig(networkName, "AlgoLsig", {
				creator: "Lsig creator",
				contractAddress: "addr-1",
				lsig: {} as LogicSigAccount,
			})
			.putMetadata(networkName, "k", "v");
		const deployerCfg = new DeployerConfig(env, new AlgoOperatorDryRunImpl());
		deployerCfg.cpData = cpData;
		const deployer = new DeployerDeployMode(deployerCfg);
		// passes
		await deployer.fundLsig(
			"AlgoLsig",
			{ funder: deployer.accounts[1], fundingMicroAlgo: 1000 },
			{}
		);
	});

	it("Should crash if lsig/app name is already present in checkpoint", async function () {
		const networkName = "network1";
		const env = mkEnv(networkName);
		const cpData = new CheckpointRepoImpl()
			.registerLsig(networkName, "MyLsig", {
				creator: "Lsig creator",
				contractAddress: "addr-1",
				lsig: {} as LogicSigAccount,
			})
			.registerSSC(networkName, "ASC name", {
				creator: "ASC creator 951",
				applicationAccount: MOCK_APPLICATION_ADDRESS,
				txID: "",
				confirmedRound: 0,
				appID: -1,
				timestamp: 1,
				deleted: false,
				approvalFile: "approval-file.py",
				clearFile: "clear-file.py",
			})
			.putMetadata(networkName, "k", "v");
		const deployerConfig = new DeployerConfig(env, new AlgoOperatorDryRunImpl());
		deployerConfig.cpData = cpData;
		const deployer = new DeployerDeployMode(deployerConfig);
		await expectBuilderErrorAsync(
			async () => deployer.assertNoLsig("MyLsig"),
			ERRORS.BUILTIN_TASKS.DEPLOYER_LSIG_ALREADY_PRESENT,
			"Lsig name is already used: MyLsig"
		);
		await expectBuilderErrorAsync(
			async () => deployer.assertNoApp("ASC name"),
			ERRORS.BUILTIN_TASKS.DEPLOYER_APP_ALREADY_PRESENT,
			"App name is already used: ASC name"
		);
	});

	it("Should return empty ASA map on no CP", async function () {
		const deployer = new DeployerDeployMode(deployerCfg);
		assert.deepEqual(deployer.asa, new Map());
	});

	it("Should return empty ASA map on no CP; with ASA in other net", async function () {
		const deployer = new DeployerDeployMode(deployerCfg);
		deployerCfg.cpData.registerASA("hi", "hi123", {
			creator: "",
			txID: "",
			confirmedRound: 0,
			assetIndex: 1337,
			assetDef: {} as wtypes.ASADef,
			deleted: false,
		});
		assert.deepEqual(deployer.asa, new Map());
	});

	it("Should return correct ASA in ASA map", async function () {
		deployerCfg.asaDefs = { ASA_key: mkASA() };
		const deployer = new DeployerDeployMode(deployerCfg);
		await deployer.deployASA("ASA_key", { creator: deployer.accounts[0] });
		assert.deepEqual(
			deployer.asa,
			new Map([
				[
					"ASA_key",
					{
						creator: "addr-1-get-address-dry-run",
						txID: "tx-id-dry-run",
						assetIndex: 1,
						confirmedRound: -1,
						assetDef: mkASA(),
						deleted: false,
					},
				],
			])
		);
	});

	it("Should deploy asa without using asa.yaml", async function () {
		const deployer = new DeployerDeployMode(deployerCfg);
		const asaDef = {
			total: 10000,
			decimals: 0,
			defaultFrozen: false,
			unitName: "SLV",
			url: "url",
			metadataHash: "12312442142141241244444411111133",
			note: "note",
		};
		await deployer.deployASADef("silver-122", asaDef, { creator: deployer.accounts[0] });

		const res = deployer.getASAInfo("silver-122");
		assert.isDefined(res);
		assert.deepEqual(res.assetDef, asaDef);
	});
});
describe("Helper functions", function () {
	useFixtureProject("abi-contract");
	const env = mkEnv("testnet");
	const deployerCfg = new DeployerConfig(env, new AlgoOperatorDryRunImpl());
	let deployer: DeployerDeployMode;
	let alice: algosdk.Account;
	let bob: algosdk.Account;

	beforeEach(function () {
		deployer = new DeployerDeployMode(deployerCfg);
		alice = generateAccount();
		bob = generateAccount();
	});

	it("Should return a transaction object based on provided execParams", function () {
		const execParams: AlgoTransferParam = {
			type: TransactionType.TransferAlgo,
			sign: SignType.SecretKey,
			fromAccount: alice,
			toAccountAddr: bob.addr,
			amountMicroAlgos: 10000n,
			payFlags: {},
		};
		const txnParams = mockSuggestedParam;
		const transactions: Transaction[] = deployer.makeTx([execParams], txnParams);
		assert.deepEqual(transactions[0].type, algosdk.TransactionType.pay);
		assert.deepEqual(algosdk.encodeAddress(transactions[0].from.publicKey), alice.addr);
		assert.deepEqual(algosdk.encodeAddress(transactions[0].to.publicKey), bob.addr);
		assert.deepEqual(transactions[0].amount, 10000n);
	});

	it("Should sign a transaction and return a SignedTransaction object", function () {
		const execParams: AlgoTransferParam = {
			type: TransactionType.TransferAlgo,
			sign: SignType.SecretKey,
			fromAccount: alice,
			toAccountAddr: bob.addr,
			amountMicroAlgos: 10000n,
			payFlags: {},
		};
		const signature: wtypes.Sign = {
			sign: SignType.SecretKey,
			fromAccount: alice,
		};
		const txnParams = mockSuggestedParam;
		const transactions: Transaction[] = deployer.makeTx([execParams], txnParams);
		assert.doesNotThrow(() => {
			deployer.signTx(transactions[0], signature);
		});
	});

	it("Should return a SignedTransaction object based on ExecParams", function () {
		const execParams: AlgoTransferParam = {
			type: TransactionType.TransferAlgo,
			sign: SignType.SecretKey,
			fromAccount: alice,
			toAccountAddr: bob.addr,
			amountMicroAlgos: 10000n,
			payFlags: {},
		};
		const signature: wtypes.Sign = {
			sign: SignType.SecretKey,
			fromAccount: alice,
		};
		const txnParams = mockSuggestedParam;
		assert.doesNotThrow(() => {
			deployer.makeAndSignTx([execParams], txnParams, signature);
		});
	});

	it("Should send a signed transaction and wait specified rounds for confirmation", function () {
		const execParams: AlgoTransferParam = {
			type: TransactionType.TransferAlgo,
			sign: SignType.SecretKey,
			fromAccount: alice,
			toAccountAddr: bob.addr,
			amountMicroAlgos: 10000n,
			payFlags: {},
		};
		const signature: wtypes.Sign = {
			sign: SignType.SecretKey,
			fromAccount: alice,
		};
		const txnParams = mockSuggestedParam;
		const signedTx = deployer.makeAndSignTx([execParams], txnParams, signature);
		assert.doesNotThrow(async () => {
			await deployer.sendTxAndWait(signedTx, 10);
		});
	});

	it("Should return correct ABIContract with the appID defined", function () {
		const pathToFile = "basic-abi.json";
		const contract = deployer.parseABIContractFile(pathToFile);
		assert.isDefined(contract);
		assert.isDefined(contract.appID);
		assert.equal(contract.appID, 123456);
	});
});
