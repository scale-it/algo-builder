import { AccountStore, getProgram, Runtime } from "@algo-builder/runtime";
import { parsing, types } from "@algo-builder/web";
import { assert } from "chai";

const minBalance = 10e6; // 10 ALGO's
const p = 3;
const ENCOUNTERRED_ERR_OPCODE = "RUNTIME_ERR1009: TEAL runtime encountered err opcode";
const REJECTED_BY_LOGIC = "RUNTIME_ERR1007: Teal code rejected by logic";

describe("Unique NFT ASA tests", function () {
	const master = new AccountStore(1000e6);
	let creator;
	let bob;
	let statelessLsig; // initialized later (using runtime.createLsigAccount)
	let statelessLsigAcc; //

	let runtime;
	let appDef;
	let nftAppID;
	let createNftTxGroup;
	let transferNftTxGroup;
	const approvalProgramFilename = "nft-app-approval.py";
	const clearProgramFilename = "nft-app-clear.py";

	this.beforeEach(async function () {
		runtime = new Runtime([master]);
		[creator, bob] = runtime.defaultAccounts();

		appDef = {
			metaType: types.MetaType.FILE,
			approvalProgramFilename,
			clearProgramFilename,
			localInts: 1,
			localBytes: 1,
			globalInts: 0,
			globalBytes: 0,
		};

		nftAppID = runtime.deployApp(creator.account, appDef, {}).appID;

		// setup stateless lsig
		const statelessLsigProg = getProgram("stateless.py", "", {
			ARG_P: p,
			ARG_NFT_APP_ID: nftAppID,
		});
		statelessLsig = runtime.createLsigAccount(statelessLsigProg, []);
		statelessLsigAcc = runtime.getAccount(statelessLsig.address());
		runtime.fundLsig(master.account, statelessLsig.address(), minBalance + 10000);
		syncAccounts();

		createNftTxGroup = [
			{
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: creator.account,
				toAccountAddr: statelessLsig.address(),
				amountMicroAlgos: 1e6,
				payFlags: { totalFee: 1000 },
			},
			{
				type: types.TransactionType.OptInToApp,
				sign: types.SignType.LogicSignature,
				fromAccountAddr: statelessLsig.address(),
				appID: nftAppID,
				payFlags: { totalFee: 1000 },
				lsig: statelessLsig,
				appArgs: [`int:${p}`],
			},
			{
				type: types.TransactionType.DeployASA,
				sign: types.SignType.LogicSignature,
				fromAccountAddr: statelessLsig.address(),
				asaName: "nft-asa",
				lsig: statelessLsig,
				payFlags: { totalFee: 1000 },
			},
		];

		transferNftTxGroup = [
			// tx 0 - Call App
			{
				type: types.TransactionType.CallApp,
				sign: types.SignType.LogicSignature,
				fromAccountAddr: statelessLsig.address(),
				appID: nftAppID,
				payFlags: { totalFee: 1000 },
				lsig: statelessLsig,
			},
			// tx 1 - transfer NFT (ASA with supply 1) from C_p => creator
			{
				type: types.TransactionType.TransferAsset,
				sign: types.SignType.LogicSignature,
				fromAccountAddr: statelessLsig.address(),
				toAccountAddr: creator.address,
				amount: 1,
				assetID: 99,
				lsig: statelessLsig,
				payFlags: { totalFee: 1000 },
			},
		];
	});

	// Update account state
	function syncAccounts() {
		[creator, bob] = runtime.defaultAccounts();
		statelessLsigAcc = runtime.getAccount(statelessLsig.address());
	}

	describe("Happy paths", function () {
		it("should create NFT by C_p", function () {
			const beforeCreatorBal = creator.balance();

			runtime.executeTx(createNftTxGroup);
			syncAccounts();

			// verify 1 ALGO payment
			assert.equal(creator.balance(), beforeCreatorBal - BigInt(1e6) - 1000n);

			// verify OptIn
			assert.isDefined(statelessLsigAcc.getAppFromLocal(nftAppID));
			assert.deepEqual(statelessLsigAcc.getLocalState(nftAppID, "p"), BigInt(p));
			assert.deepEqual(
				statelessLsigAcc.getLocalState(nftAppID, "creator"),
				parsing.addressToPk(creator.address)
			);

			// verify ASA deployment by C_p
			const assetInfo = runtime.getAssetInfoFromName("nft-asa");
			assert.isDefined(assetInfo);
			assert.deepEqual(assetInfo.assetDef.creator, statelessLsig.address());
			assert.deepEqual(assetInfo.assetDef.total, 1n);
			assert.deepEqual(assetInfo.assetDef.decimals, 0);
		});

		it("should allow creation of NFT, if payment is not done by creator", function () {
			// payment of 1 ALGO by bob
			createNftTxGroup[0].fromAccount = bob.account;
			assert.doesNotThrow(() => runtime.executeTx(createNftTxGroup));
		});

		it("should transfer NFT from C_p => Creator", function () {
			runtime.executeTx(createNftTxGroup);
			syncAccounts();

			// optInToASA  by creator (before transfer)
			const assetIndex = runtime.getAssetInfoFromName("nft-asa").assetIndex;
			runtime.optInToASA(assetIndex, creator.address, {});
			syncAccounts();

			// verify optIn
			assert.isDefined(creator.getAssetHolding(assetIndex));

			const beforeCreatorHolding = creator.getAssetHolding(assetIndex).amount;
			const beforeLsigHolding = statelessLsigAcc.getAssetHolding(assetIndex).amount;

			transferNftTxGroup[1].assetID = assetIndex;
			runtime.executeTx(transferNftTxGroup);
			syncAccounts();

			// verify NFT transfer
			assert.deepEqual(
				statelessLsigAcc.getAssetHolding(assetIndex).amount,
				beforeLsigHolding - 1n
			);
			assert.deepEqual(creator.getAssetHolding(assetIndex).amount, beforeCreatorHolding + 1n);
		});
	});

	describe("failing paths", function () {
		describe("Create NFT", function () {
			it("should reject creation if deploying same NFT again (with same C_p)", function () {
				runtime.executeTx(createNftTxGroup);

				assert.throws(
					() => runtime.executeTx(createNftTxGroup),
					`${statelessLsig.address()} is already opted in to app ${nftAppID}`
				);
			});

			it("should reject creation if payment amount is not 1 ALGO", function () {
				createNftTxGroup[0].amountMicroAlgos = 0.9e6; // 0.9 ALGO
				assert.throws(() => runtime.executeTx(createNftTxGroup), REJECTED_BY_LOGIC);

				createNftTxGroup[0].amountMicroAlgos = 1.1e6; // 1.1 ALGO
				assert.throws(() => runtime.executeTx(createNftTxGroup), REJECTED_BY_LOGIC);
			});

			it("should reject creation if prime(p) is not correct", function () {
				// stateless_lsig is made of p=3 (hardcoded), but in appArgs we pass p=7
				createNftTxGroup[1].appArgs = [`int:${7}`];

				assert.throws(() => runtime.executeTx(createNftTxGroup), REJECTED_BY_LOGIC);
			});

			it("should reject creation if txGroup is invalid", function () {
				// ALGO payment missing
				assert.throws(
					() => runtime.executeTx([{ ...createNftTxGroup[1] }, { ...createNftTxGroup[2] }]),
					REJECTED_BY_LOGIC
				);

				// OptIn Missing
				assert.throws(
					() => runtime.executeTx([{ ...createNftTxGroup[0] }, { ...createNftTxGroup[2] }]),
					REJECTED_BY_LOGIC
				);

				// ASA deployment missing
				assert.throws(
					() => runtime.executeTx([{ ...createNftTxGroup[0] }, { ...createNftTxGroup[1] }]),
					REJECTED_BY_LOGIC
				);
			});
		});

		describe("Transfer NFT", function () {
			const createNFT = function () {
				runtime.executeTx(createNftTxGroup);
				const assetIndex = runtime.getAssetInfoFromName("nft-asa").assetIndex;
				transferNftTxGroup[1].assetID = assetIndex;
				runtime.optInToASA(assetIndex, creator.address, {});
				syncAccounts();
			};

			it("should reject transfer if creator not opted in to NFT(ASA)", function () {
				runtime.executeTx(createNftTxGroup);

				assert.throws(
					() => runtime.executeTx(transferNftTxGroup),
					`Account ${statelessLsig.address()} doesn't hold asset`
				);
			});

			it("should reject transfer if trying to transfer ASA with amount > 1", function () {
				createNFT();

				transferNftTxGroup[1].amount = 2;
				assert.throws(
					() => runtime.executeTx(transferNftTxGroup),
					`Cannot withdraw 2 assets from account ${statelessLsig.address()}: insufficient balance`
				);
			});

			it("should reject transfer if trying to transfer NFT to account other than creator", function () {
				createNFT();

				// trying to transfer created NFT to bob
				transferNftTxGroup[1].toAccountAddr = bob.address;
				assert.throws(() => runtime.executeTx(transferNftTxGroup), ENCOUNTERRED_ERR_OPCODE);
			});

			it("should reject transfer if txGroup is invalid", function () {
				createNFT();

				// transfer missing
				assert.throws(
					() => runtime.executeTx([{ ...transferNftTxGroup[0] }]),
					ENCOUNTERRED_ERR_OPCODE
				);

				// call to NFT App missing
				assert.throws(
					() => runtime.executeTx([{ ...transferNftTxGroup[1] }]),
					ENCOUNTERRED_ERR_OPCODE
				);
			});
		});
	});
});
