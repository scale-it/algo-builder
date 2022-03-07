import { assert } from "chai";

import { bigintSqrt } from "../../../src/lib/math";

describe("Math package", function () {
	it("sqrt function", () => {
		const inputs = [4n, 10n, 25n, BigInt(1e8), 1n << 64n, (1n << 64n) - 1n];
		const outputs = [2n, 3n, 5n, BigInt(1e4), 1n << 32n, (1n << 32n) - 1n];
		inputs.forEach((value, index) => {
			assert.equal(bigintSqrt(value), outputs[index]);
		});
	});
});
