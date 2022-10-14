import { assert } from "chai";

import { fromEntries } from "../../../src/internal/util/lang";

describe("From entries", function () {
	it("Should return an empty object if entries is an empty array", function () {
		assert.deepEqual(fromEntries([]), {});
	});

	it("Should construct an object", function () {
		const o = {};
		assert.deepEqual(
			fromEntries([
				["a", 1],
				["b", true],
				["c", o],
			]),
			{
				a: 1,
				b: true,
				c: o,
			}
		);
	});

	it("Should keep the last entry if there are multiple ones with the same key", function () {
		assert.deepEqual(
			fromEntries([
				["a", 1],
				["b", 2],
				["a", 3],
			]),
			{
				a: 3,
				b: 2,
			}
		);
	});
});
