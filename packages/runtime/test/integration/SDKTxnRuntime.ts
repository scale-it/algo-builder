// import { tx as webTx, types } from "@algo-builder/web";
// import { assert } from "chai";
// import cloneDeep from "lodash.clonedeep";

// import { AccountStore } from "../../src/account";
// import { mockSuggestedParams } from "../../src/mock/tx";
// import { Runtime } from "../../src/runtime";
// import { AccountStoreI } from "../../src/types";
// import { useFixture } from "../helpers/integration";

// const minBalance = BigInt(10 * 1e6);

// // TODO: add more test for all transaction types.
// // https://www.pivotaltracker.com/n/projects/2452320/stories/181383052
// describe("Should execute SDK transaction object using runtime", function () {
// 	const fee = 1000;

// 	let alice: AccountStoreI;
// 	let smith: AccountStoreI;
// 	let runtime: Runtime;

// 	let execParams: types.ExecParams;

// 	function mkTransactionAndSign(
// 		runtime: Runtime,
// 		execParams: types.ExecParams
// 	): types.TransactionAndSign {
// 		const suggestedParams = mockSuggestedParams(execParams.payFlags, runtime.getRound());
// 		let transaction;

// 		if (execParams.type == types.TransactionType.DeployApp) {
// 			const cloneExecParams = cloneDeep(execParams);
// 			cloneExecParams.appDefinition = {
// 				...cloneExecParams.appDefinition,
// 				metaType: types.MetaType.BYTES,
// 				approvalProgramBytes: new Uint8Array(32),
// 				clearProgramBytes: new Uint8Array(32),
// 			};
// 			transaction = webTx.mkTransaction(cloneExecParams, suggestedParams) as any;
// 		} else {
// 			transaction = webTx.mkTransaction(execParams, suggestedParams) as any;
// 		}

// 		let sign: types.Sign;

// 		// extract `sign` from execParams
// 		if (execParams.sign === types.SignType.SecretKey) {
// 			sign = {
// 				sign: execParams.sign,
// 				fromAccount: execParams.fromAccount,
// 			};
// 		} else {
// 			sign = {
// 				sign: execParams.sign,
// 				lsig: execParams.lsig,
// 				fromAccountAddr: execParams.fromAccountAddr,
// 			};
// 		}

// 		// inject approval and clear program in string format to transaction object.
// 		// TODO: Should we create disassemble method to convert Uint8Array program format to string???
// 		if (execParams.type === types.TransactionType.DeployApp) {
// 			const appDef = execParams.appDefinition as types.AppDefinitionFromFile;
// 			transaction.approvalProgram = appDef.approvalProgramFilename;
// 			transaction.clearProgram = appDef.clearProgramFilename;
// 		}
// 		return {
// 			transaction,
// 			sign,
// 		};
// 	}

// 	this.beforeEach(() => {
// 		alice = new AccountStore(minBalance * 10n);
// 		smith = new AccountStore(minBalance * 10n);
// 		runtime = new Runtime([alice, smith]);
// 	});

// 	describe("ASA transaction", function () {
// 		useFixture("asa-check");
// 		it("Should deploy ASA transaction", () => {
// 			const asaName = "gold";
// 			const asaDef = runtime.loadedAssetsDefs[asaName];

// 			execParams = {
// 				sign: types.SignType.SecretKey,
// 				fromAccount: alice.account,
// 				type: types.TransactionType.DeployASA,
// 				asaName,
// 				asaDef,
// 				payFlags: {
// 					totalFee: fee,
// 				},
// 			};

// 			const txAndSign = mkTransactionAndSign(runtime, execParams);
// 			assert.doesNotThrow(() => runtime.executeTx([txAndSign]));

// 			const asaInfo = runtime.getAssetInfoFromName(asaName);
// 			if (asaInfo) {
// 				assert.isDefined(asaInfo);
// 				assert.equal(asaInfo.creator, alice.address);
// 				assert.isFalse(asaInfo.deleted);
// 				assert.equal(asaDef.name, asaInfo.assetDef.name);
// 				assert.equal(asaDef.defaultFrozen, asaInfo.assetDef.defaultFrozen);
// 				assert.equal(asaDef.decimals, asaInfo.assetDef.decimals);
// 				assert.equal(asaDef.total, asaInfo.assetDef.total);
// 				assert.equal(asaDef.clawback, asaInfo.assetDef.clawback);
// 				assert.equal(asaDef.freeze, asaInfo.assetDef.freeze);
// 				assert.equal(asaDef.manager, asaInfo.assetDef.manager);
// 				assert.equal(asaDef.reserve, asaInfo.assetDef.reserve);
// 			}
// 		});
// 	});

// 	describe("Application Transaction", function () {
// 		useFixture("stateful");
// 		let execParams: types.ExecParams;
// 		this.beforeEach(() => {
// 			execParams = {
// 				type: types.TransactionType.DeployApp,
// 				sign: types.SignType.SecretKey,
// 				fromAccount: alice.account,
// 				appDefinition: {
// 					appName: "app",
// 					metaType: types.MetaType.FILE,
// 					approvalProgramFilename: "counter-approval.teal",
// 					clearProgramFilename: "clear.teal",
// 					localBytes: 1,
// 					localInts: 1,
// 					globalBytes: 1,
// 					globalInts: 1,
// 				},
// 				payFlags: {
// 					totalFee: fee,
// 				},
// 			};

// 			const txAndSign = mkTransactionAndSign(runtime, execParams);
// 			runtime.executeTx([txAndSign]);
// 		});

// 		it("Should check if application exists after deployment", () => {
// 			const appInfo = runtime.getAppInfoFromName("counter-approval.teal", "clear.teal");
// 			assert.isDefined(appInfo);
// 		});
// 	});

// 	describe("Payment transaciton", function () {
// 		it("Should transfer ALGO transaction", () => {
// 			execParams = {
// 				sign: types.SignType.SecretKey,
// 				type: types.TransactionType.TransferAlgo,
// 				fromAccount: alice.account,
// 				toAccountAddr: smith.address,
// 				amountMicroAlgos: 1000n,
// 				payFlags: {
// 					totalFee: fee,
// 				},
// 			};

// 			const txAndSign = mkTransactionAndSign(runtime, execParams);

// 			assert.doesNotThrow(() => runtime.executeTx([txAndSign]));
// 		});
// 	});
// });
