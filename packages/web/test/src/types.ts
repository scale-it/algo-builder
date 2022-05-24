import { assert } from "chai";

import { isSDKTransactionAndSign, SignType } from "../../src/types";
import { txObject } from "../mocks/tx";

describe("Transaction And Sign interface", () => {
	it("should return false if transaction object is not SDK transaction", () => {
		const param: unknown = {
			transaction: { name: "AA" },
			sign: { sign: "sd" },
		};

		assert.isFalse(isSDKTransactionAndSign(param));
	});

	it("should return false if sign is not in transaction", () => {
		const param: unknown = {
			transaction: txObject,
		};

		assert.isFalse(isSDKTransactionAndSign(param));
	});

	it("should return true if sign and transaction is present", () => {
		const param: unknown = {
			transaction: txObject,
			sign: { sign: SignType.SecretKey, fromAccount: [] },
		};

		assert.isTrue(isSDKTransactionAndSign(param));
	});
});
