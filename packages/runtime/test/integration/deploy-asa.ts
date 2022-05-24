import { assert } from "chai";

import { AccountStore, Runtime } from "../../src/index";
import { useFixture } from "../helpers/integration";

const minBalance = 1e6;

describe("Deploy ASA with mutiple opt-in accounts", function () {
	useFixture("deploy-asa");
	let john: AccountStore;
	let bob: AccountStore;
	let runtime: Runtime;
	let alice: AccountStore;

	this.beforeAll(async function () {
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
});
