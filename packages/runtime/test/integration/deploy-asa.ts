import { assert } from "chai";

import RUNTIME_ERRORS from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

const minBalance = 1e6;

describe("Deploy ASA with mutiple opt-in accounts", function () {
	useFixture("deploy-asa");
	let john: AccountStore;
	let bob: AccountStore;
	let runtime: Runtime;
	let alice: AccountStore;

	this.beforeEach(async function () {
		john = new AccountStore(minBalance, "john");
		bob = new AccountStore(minBalance, "bob");
		alice = new AccountStore(minBalance, "alice");
		runtime = new Runtime([john, bob, alice]);
	});

	// helper function
	function syncAccounts(): void {
		john = runtime.getAccount(john.address);
		bob = runtime.getAccount(bob.address);
		alice = runtime.getAccount(alice.address);
	}

	it("Should opt-in to multiple accounts mentioned in asa.yaml", () => {
		const asset = runtime.deployASA("asa", {
			creator: { ...john.account, name: "john" },
		}).assetIndex;

		syncAccounts();
		assert.isDefined(bob.getAssetHolding(asset));
		assert.isDefined(alice.getAssetHolding(asset));
	});

	it("Should throw error when ASA definition not found in asa.yaml", () => {
		expectRuntimeError(
			() =>
				runtime.deployASA("asa-invalid", {
					creator: { ...john.account, name: "john" },
				}),
			RUNTIME_ERRORS.ASA.ASA_DEFINITION_NO_FOUND_IN_ASA_FILE
		);
	});

	describe("ASA file is undefinded", function () {
		useFixture("loop"); // project don't have asa-file
		it("Should fail b/c we tried to get asa from asa file for deploy", () => {
			expectRuntimeError(
				() =>
					runtime.deployASA("asa", {
						creator: { ...john.account, name: "john" },
					}),
				RUNTIME_ERRORS.ASA.ASA_FILE_IS_UNDEFINED
			);
		});
	});
});
