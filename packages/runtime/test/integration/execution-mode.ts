import { convert } from "@algo-builder/algob";
import { types } from "@algo-builder/web";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

const minBalance = BigInt(1e6);
const initialJohnHolding = minBalance + 2000n;
const initialBobHolding = minBalance + 500n;
const fee = 1000;

describe("TEAL: Execution modes", function () {
	useFixture("basic-teal");
	let john: AccountStore;
	let bob: AccountStore;
	let runtime: Runtime;

	this.beforeAll(async function () {
		john = new AccountStore(initialJohnHolding);
		bob = new AccountStore(initialBobHolding);
		runtime = new Runtime([john, bob]);
	});

	describe("Application ops used in signature mode", function () {
		it("should fail in signature mode if application mode opcode is used", function () {
			// make delegated logic signature
			const lsig = runtime.loadLogic("sig-mode.teal");
			lsig.sign(john.account.sk);

			const txParams: types.ExecParams = {
				type: types.TransactionType.TransferAlgo, // payment
				sign: types.SignType.LogicSignature,
				fromAccountAddr: john.account.addr,
				toAccountAddr: bob.address,
				amountMicroAlgos: 100n,
				lsig: lsig,
				payFlags: { totalFee: fee },
			};

			expectRuntimeError(
				() => runtime.executeTx([txParams]),
				RUNTIME_ERRORS.TEAL.EXECUTION_MODE_NOT_VALID
			);
		});

		it("should pass in application mode", function () {
			const appDefinition: types.AppDefinition = {
				appName: "app",
				metaType: types.MetaType.FILE,
				approvalProgramFilename: "sig-mode.teal",
				clearProgramFilename: "clear.teal",
				globalBytes: 1,
				globalInts: 1,
				localBytes: 1,
				localInts: 1,
			};

			// deployApp is also an application mode transaction
			assert.doesNotThrow(() => runtime.deployApp(john.account, appDefinition, {}));
		});
	});

	describe("Signature ops used in application mode", function () {
		it("should fail in application mode if Signature mode opcode is used", function () {
			const appDefinition: types.AppDefinition = {
				appName: "app",
				metaType: types.MetaType.FILE,
				approvalProgramFilename: "app-mode.teal",
				clearProgramFilename: "clear.teal",
				globalBytes: 1,
				globalInts: 1,
				localBytes: 1,
				localInts: 1,
			};

			expectRuntimeError(
				() => runtime.deployApp(john.account, appDefinition, {}),
				RUNTIME_ERRORS.TEAL.EXECUTION_MODE_NOT_VALID
			);
		});

		it("should pass in signature mode", function () {
			// make delegated logic signature
			const lsig = runtime.loadLogic("app-mode.teal");

			lsig.sign(john.account.sk);

			const txParams: types.ExecParams = {
				type: types.TransactionType.TransferAlgo, // payment
				sign: types.SignType.LogicSignature,
				fromAccountAddr: john.account.addr,
				toAccountAddr: bob.address,
				amountMicroAlgos: 100n,
				lsig: lsig,
				args: [convert.stringToBytes("Algorand")],
				payFlags: { totalFee: fee },
			};

			assert.doesNotThrow(() => runtime.executeTx([txParams]));
		});
	});
});
