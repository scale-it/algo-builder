import { convert } from "@algo-builder/algob";
import { types } from "@algo-builder/web";
import { decodeAddress, multisigAddress, MultisigMetadata } from "algosdk";
import { assert } from "chai";

import { AccountStore } from "../../src/account";
import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { Runtime } from "../../src/runtime";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

const programName = "escrow.teal";
const multiSigProg = "sample-asc.teal";
const crowdFundEscrow = "crowdFundEscrow.teal";

describe("Logic Signature", function () {
	useFixture("escrow-account");
	let john: AccountStore;
	let bob: AccountStore;
	let runtime: Runtime;
	let johnPk: Uint8Array;
	let goal: number;
	let crowdfundApprovalFileName: string;
	let crowdFundClearFileName: string;
	let now: Date;
	let beginDate: Date;
	let endDate: Date;
	let fundCloseDate: Date;
	let creationArgs: any;
	let appDefinition: any;
	let applicationId: any;

	before(function () {
		john = new AccountStore(10);
		bob = new AccountStore(10e6);
		runtime = new Runtime([john, bob]);
		johnPk = decodeAddress(john.address).publicKey;
		goal = 0.01e6;
		crowdfundApprovalFileName = "crowdFundApproval.teal";
		crowdFundClearFileName = "crowdFundClear.teal";
		now = new Date();
		beginDate = endDate = fundCloseDate = now;
		beginDate.setSeconds(now.getSeconds() + 2);
		endDate.setSeconds(now.getSeconds() + 12000);
		fundCloseDate.setSeconds(fundCloseDate.getSeconds() + 120000);

		creationArgs = [
			convert.uint64ToBigEndian(beginDate.getTime()),
			convert.uint64ToBigEndian(endDate.getTime()),
			`int:${goal}`, // args similar to `goal --app-arg ..` are also supported
			convert.addressToPk(bob.address),
			convert.uint64ToBigEndian(fundCloseDate.getTime()),
		];

		appDefinition = {
			appName: "crowdfundingApp",
			metaType: types.MetaType.FILE,
			approvalProgramFilename: crowdfundApprovalFileName,
			clearProgramFilename: crowdFundClearFileName,
			localInts: 1,
			localBytes: 0,
			globalInts: 5,
			globalBytes: 3,
		};
	});

	it("john should be able to create a delegated signature", function () {
		const lsig = runtime.loadLogic(programName);

		lsig.sign(john.account.sk);
		assert.isTrue(lsig.lsig.verify(johnPk));
	});

	it("should fail to verify delegated signature signed by someone else", function () {
		const lsig = runtime.loadLogic(programName);

		lsig.sign(bob.account.sk);
		const result = lsig.lsig.verify(johnPk);

		assert.equal(result, false);
	});

	it("should handle contract lsig (escrow account) verification correctly", function () {
		const lsig = runtime.loadLogic(programName);

		let result = lsig.lsig.verify(decodeAddress(lsig.address()).publicKey);
		assert.equal(result, true);

		result = lsig.lsig.verify(johnPk);
		assert.equal(result, false);
	});

	it("should fail if empty program is passed", function () {
		expectRuntimeError(
			() => runtime.createLsigAccount("", []),
			RUNTIME_ERRORS.GENERAL.INVALID_PROGRAM
		);
	});

	it("should return same address for same program", function () {
		let lsig = runtime.loadLogic(programName);

		const addr = lsig.address();
		lsig = runtime.loadLogic(programName);

		assert.equal(lsig.address(), addr);
	});

	it("Should handle contract lsig (escrow account) verification correctly with empty smart contract params", function () {
		// empty smart contract param with teal
		const lsig = runtime.loadLogic(programName, {});

		let result = lsig.lsig.verify(decodeAddress(lsig.address()).publicKey);
		assert.equal(result, true);

		result = lsig.lsig.verify(johnPk);
		assert.equal(result, false);
	});

	it("Should handle contract lsig (crowd fund escrow account) verification correctly with non-empty smart contract params", function () {
		// create application
		applicationId = runtime.deployApp(
			bob.account,
			{ ...appDefinition, appArgs: creationArgs },
			{}
		).appID;

		assert(applicationId);
		// setup escrow account
		const lsig = runtime.loadLogic(crowdFundEscrow, { APP_ID: applicationId });
		let result = lsig.lsig.verify(decodeAddress(lsig.address()).publicKey);
		assert.equal(result, true);

		result = lsig.lsig.verify(johnPk);
		assert.equal(result, false);
	});
});

describe("Multi-Signature Test", function () {
	useFixture("multi-signature");
	let alice: AccountStore;
	let john: AccountStore;
	let bob: AccountStore;
	let runtime: Runtime;
	let bobPk: Uint8Array;
	let mparams: MultisigMetadata;
	let multisigAddr: string;

	// note: it's better to do intializations in before, beforeAll.. hooks
	// because cwd path (after loading env in fixture-project) is correctly
	// initialized in these hooks
	// eg. during new Runtime([..]).loadASAFile, path(cwd) to fetch asa.yaml file
	// is correct.
	before(function () {
		alice = new AccountStore(10);
		john = new AccountStore(100);
		bob = new AccountStore(1000);
		bobPk = decodeAddress(bob.address).publicKey;

		runtime = new Runtime([alice, john, bob]);

		// Generate multi signature account hash
		const addrs = [alice.address, john.address, bob.address];
		mparams = {
			version: 1,
			threshold: 2,
			addrs: addrs,
		};
		multisigAddr = multisigAddress(mparams);
	});

	it("should verify if threshold is verified and sender is multisigAddr", function () {
		const lsig = runtime.loadLogic(multiSigProg);
		// lsig signed by alice
		lsig.signMultisig(mparams, alice.account.sk);
		// lsig signed again (threshold = 2) by john
		lsig.appendToMultisig(john.account.sk);

		const result = lsig.lsig.verify(decodeAddress(multisigAddr).publicKey);
		assert.equal(result, true);
	});

	it("should not verify if threshold is achieved but sender is not multisigAddr", function () {
		const lsig = runtime.loadLogic(multiSigProg);
		// lsig signed by alice
		lsig.signMultisig(mparams, alice.account.sk);
		// lsig signed again (threshold = 2) by john
		lsig.appendToMultisig(john.account.sk);

		const result = lsig.lsig.verify(bobPk);
		assert.equal(result, false);
	});

	it("should not verify if threshold is not achieved but sender is multisigAddr", function () {
		const lsig = runtime.loadLogic(multiSigProg);
		// lsig signed by alice
		lsig.signMultisig(mparams, alice.account.sk);

		const result = lsig.lsig.verify(decodeAddress(multisigAddr).publicKey);
		assert.equal(result, false);
	});
});
