import {
	betanetGenesisHash,
	mainnetGenesisHash,
	runtimeGenesisHash,
	testnetGenesisHash,
	utils,
} from "@algo-builder/web";
import { expect } from "chai";

describe("Utility functions from algob/web", function () {
	describe("getGenesisHashFromName()", function () {
		const testGenesisHash = [
			{ name: "mainnet", expected: mainnetGenesisHash },
			{ name: "testnet", expected: testnetGenesisHash },
			{ name: "betanet", expected: betanetGenesisHash },
			{ name: "runtime", expected: runtimeGenesisHash },
		];

		testGenesisHash.forEach(({ name, expected }) => {
			it(`Should return ${expected} for ${name}`, function () {
				expect(utils.getGenesisHashFromName(name)).to.equal(expected);
			});
		});
	});
});
