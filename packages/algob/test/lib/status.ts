import algosdk from "algosdk";
import { expect } from "chai";
import sinon from "sinon";

import { DeployerRunMode } from "../../src/internal/deployer";
import { DeployerConfig } from "../../src/internal/deployer_cfg";
import { balanceOf } from "../../src/lib/status";
import { Deployer } from "../../src/types";
import { mkEnv } from "../helpers/params";
import { mockAccountInformation } from "../mocks/tx";
import { AlgoOperatorDryRunImpl } from "../stubs/algo-operator";

describe("Status package", () => {
	let deployer: Deployer;
	const algod = new AlgoOperatorDryRunImpl();
	const env = mkEnv("network1");
	const deployerCfg = new DeployerConfig(env, algod);

	before(async () => {
		deployer = new DeployerRunMode(deployerCfg);

		(sinon.stub(algod.algodClient, "accountInformation") as any).returns({
			do: async () => mockAccountInformation,
		}) as ReturnType<algosdk.Algodv2["accountInformation"]>;
	});

	after(async () => {
		(algod.algodClient.accountInformation as sinon.SinonStub).restore();
	});

	it("balanceOf should return corrent amount when account hold an asset", async () => {
		const assetID = mockAccountInformation.assets[0]["asset-id"];
		const amount = mockAccountInformation.assets[0].amount;
		expect(await balanceOf(deployer, mockAccountInformation.address, assetID)).to.equal(amount);
	});

	it("balanceOf should return 0 when account does hold an asset", async () => {
		const otherAssetID = 0;
		expect(await balanceOf(deployer, mockAccountInformation.address, otherAssetID)).to.equal(
			0n
		);
	});

	it("balaceOf should return account balance(in ALGO) when assetID undefined", async () => {
		expect(await balanceOf(deployer, mockAccountInformation.address)).to.equal(
			mockAccountInformation.amount
		);
	});
});
