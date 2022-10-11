import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

const minBalance = 1e6;

describe("Deploy ASA with mutiple opt-in accounts", function () {
	useFixture("asa-load-fail");
	let john: AccountStore;
	let bob: AccountStore;
	let alice: AccountStore;

	it("Should not load runtime, because while loading asa.yaml, account doesn't exist", function () {
		john = new AccountStore(minBalance, "john");
		bob = new AccountStore(minBalance, "bob");
		alice = new AccountStore(minBalance, "alice");
		expectRuntimeError(
			() => new Runtime([john, bob, alice]),
			RUNTIME_ERRORS.ASA.PARAM_ERROR_NO_NAMED_OPT_IN_ACCOUNT
		);
	});

	it("Should load runtime if all accounts exist", function () {
		const elon = new AccountStore(minBalance, "elon");
		bob = new AccountStore(minBalance, "bob");
		alice = new AccountStore(minBalance, "alice");

		/* eslint-disable no-new */
		new Runtime([elon, bob, alice]);
	});
});
