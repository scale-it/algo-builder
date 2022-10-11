import { types } from "@algo-builder/web";
import { assert } from "chai";
import * as crypto from "crypto";

import { RUNTIME_ERRORS } from "../../../src/errors/errors-list";
import { validateASADefs } from "../../../src/lib/asa";
import { Account } from "../../../src/types";
import { expectRuntimeError } from "../../helpers/runtime-errors";

const namedAccount: Account = {
	name: "hi",
	addr: "addr",
	sk: new Uint8Array(1),
};

describe("ASA parser", function () {
	it("Should validate correct obj", async function () {
		const asaUrl = "u".repeat(96);
		const valid: types.ASADefs = {
			A1: {
				total: 1,
				decimals: 0,
				unitName: "ASA",
				url: asaUrl, // url upto 96 bytes is allowed
				defaultFrozen: false,
				manager: "manager",
				reserve: "",
			},
		};
		const parsed = validateASADefs(valid, new Map<string, Account>(), "");
		assert.deepEqual(parsed, {
			A1: {
				name: "A1",
				total: 1,
				decimals: 0,
				unitName: "ASA",
				url: asaUrl,
				defaultFrozen: false,
				manager: "manager",
				reserve: undefined,
				freeze: undefined,
				clawback: undefined,
			},
		});
	});

	it("Should validate all parameters", async function () {
		const valid = {
			A1: {
				total: 213,
				decimals: 12,
				defaultFrozen: true,
				unitName: "unitName",
				url: "url",
				metadataHash: "32ByteLongString32ByteLongString",
				note: "note",
				noteb64: "noteb64",
				manager: "manager",
				reserve: "reserve",
				freeze: "freeze",
				clawback: "clawback",
			},
		};
		const parsed = validateASADefs(valid, new Map<string, Account>(), "");
		assert.deepEqual(parsed, {
			A1: {
				name: "A1",
				clawback: "clawback",
				decimals: 12,
				defaultFrozen: true,
				freeze: "freeze",
				manager: "manager",
				metadataHash: "32ByteLongString32ByteLongString",
				note: "note",
				noteb64: "noteb64",
				reserve: "reserve",
				total: 213,
				unitName: "unitName",
				url: "url",
			},
		});
	});

	it("Should check total to be a number", async function () {
		const obj = {
			A1: {
				total: "hi",
				decimals: 0,
				unitName: "ASA",
				defaultFrozen: false,
			},
		};
		expectRuntimeError(
			() => validateASADefs(obj, new Map<string, Account>(), ""),
			RUNTIME_ERRORS.ASA.PARAM_PARSE_ERROR,
			"total"
		);
	});

	it("Should accept ASA with total == 0", async function () {
		const obj = {
			A1: {
				total: 0,
				decimals: 0,
				unitName: "ASA",
				defaultFrozen: false,
			},
		};
		assert.doesNotThrow(() => validateASADefs(obj, new Map<string, Account>(), ""));
	});

	it("Should check total to be a positive number <= 2^64 - 1", async function () {
		let obj = {
			A1: {
				total: 0xffffffffffffffffn + 5n,
				decimals: 0,
				defaultFrozen: false,
			},
		} as any;
		expectRuntimeError(
			() => validateASADefs(obj, new Map<string, Account>(), ""),
			RUNTIME_ERRORS.ASA.PARAM_PARSE_ERROR,
			"total"
		);

		obj = {
			A1: {
				total: -5n,
				decimals: 0,
				defaultFrozen: false,
			},
		};
		expectRuntimeError(
			() => validateASADefs(obj, new Map<string, Account>(), ""),
			RUNTIME_ERRORS.ASA.PARAM_PARSE_ERROR,
			"total"
		);
	});

	it("Should include filename", async function () {
		const obj = {
			A1: {
				total: "hi",
				decimals: 0,
				unitName: "ASA",
				defaultFrozen: false,
			},
		};
		expectRuntimeError(
			() => validateASADefs(obj, new Map<string, Account>(), "SOME_FILENAME"),
			RUNTIME_ERRORS.ASA.PARAM_PARSE_ERROR,
			"SOME_FILENAME"
		);
	});

	it("Should validate decimals", async function () {
		const obj = {
			A1: {
				total: 1,
				decimals: 20,
				unitName: "ASA",
				defaultFrozen: false,
			},
		};
		expectRuntimeError(
			() => validateASADefs(obj, new Map<string, Account>(), ""),
			RUNTIME_ERRORS.ASA.PARAM_PARSE_ERROR,
			"decimals"
		);
	});

	it("Should validate unitName; too long", async function () {
		const obj = {
			A1: {
				total: 1,
				decimals: 1,
				unitName: "123456789",
				defaultFrozen: false,
			},
		};
		expectRuntimeError(
			() => validateASADefs(obj, new Map<string, Account>(), ""),
			RUNTIME_ERRORS.ASA.PARAM_PARSE_ERROR,
			"unitName"
		);
	});

	it("Should validate url; too long", async function () {
		const obj = {
			A1: {
				total: 1,
				decimals: 1,
				// more than 96 bytes:
				url: "u".repeat(97),
				unitName: "ASA",
				defaultFrozen: false,
			},
		};
		expectRuntimeError(
			() => validateASADefs(obj, new Map<string, Account>(), ""),
			RUNTIME_ERRORS.ASA.PARAM_PARSE_ERROR,
			"url"
		);
	});

	it("Should validate metadataHash", async function () {
		/** negative paths **/

		// check utf-8 strings
		const asaDefs = {
			A1: {
				total: 1,
				decimals: 1,
				unitName: "ASA",
				// more than 32 bytes:
				metadataHash: "1234567890abcdef1234567890xyzklmnone_",
				defaultFrozen: false,
			} as types.ASADef,
		};

		const expectFail = (msg: string): void =>
			expectRuntimeError(
				() => validateASADefs(asaDefs, new Map<string, Account>(), ""),
				RUNTIME_ERRORS.ASA.PARAM_PARSE_ERROR,
				"Metadata Hash must be a 32 byte",
				msg
			);

		expectFail("metadataHash too long");

		asaDefs.A1.metadataHash = "too short";
		expectFail("metadataHash too short");

		// check with bytes array

		asaDefs.A1.metadataHash = new Uint8Array(
			Buffer.from(
				"aaabbba664143504f346e52674f35356a316e64414b3357365367633441506b63794668",
				"hex"
			)
		);
		expectFail("byte array too long");

		asaDefs.A1.metadataHash = new Uint8Array(Buffer.from("a8", "hex"));
		expectFail("byte array too short");

		// digest with a parameter will return string ... which will be too long
		const content = "some content";
		asaDefs.A1.metadataHash = crypto.createHash("sha256").update(content).digest("hex");
		expectFail("Hex string should be converted to a UInt8Array");

		/** potitive test **/

		asaDefs.A1.metadataHash = new Uint8Array(
			Buffer.from("664143504f346e52674f35356a316e64414b3357365367633441506b63794668", "hex")
		);
		let a = validateASADefs(asaDefs, new Map<string, Account>(), "");
		assert.instanceOf(
			a.A1.metadataHash,
			Uint8Array,
			"valid, 64-long character hex string converted to byte array must work"
		);

		// digest with no parameters returns Buffer
		asaDefs.A1.metadataHash = crypto.createHash("sha256").update(content).digest();
		a = validateASADefs(asaDefs, new Map<string, Account>(), "");
		assert.instanceOf(a.A1.metadataHash, Uint8Array, "sha256 hash buffer must work");

		// digest with no parameters returns Buffer
		asaDefs.A1.metadataHash = new Uint8Array(
			crypto.createHash("sha256").update(content).digest()
		);
		a = validateASADefs(asaDefs, new Map<string, Account>(), "");
		assert.instanceOf(a.A1.metadataHash, Uint8Array, "sha256 hash bytes array must work");

		asaDefs.A1.metadataHash = "s".repeat(32);
		a = validateASADefs(asaDefs, new Map<string, Account>(), "");
		assert.typeOf(
			a.A1.metadataHash,
			"string",
			"valid, 64-long character hex string converted to byte array must work"
		);
	});

	it("Should check existence of opt-in account name accounts; green path", async function () {
		const obj = {
			A1: {
				total: 1,
				decimals: 1,
				unitName: "ASA",
				optInAccNames: ["hi"],
				defaultFrozen: false,
			},
		};
		validateASADefs(obj, new Map<string, Account>([["hi", namedAccount]]), "");
	});

	it("Should check existence of opt-in account name accounts; empty", async function () {
		const obj = {
			A1: {
				total: 1,
				decimals: 1,
				unitName: "ASA",
				optInAccNames: [],
				defaultFrozen: false,
			},
		};
		validateASADefs(obj, new Map<string, Account>([["hi", namedAccount]]), "");
	});

	it("Should fail if opt-in account doesn't exist", async function () {
		const obj = {
			A1: {
				total: 1,
				decimals: 1,
				unitName: "ASA",
				optInAccNames: ["hi", "hi123"],
				defaultFrozen: false,
			},
		};
		expectRuntimeError(
			() => validateASADefs(obj, new Map<string, Account>([["hi", namedAccount]]), ""),
			RUNTIME_ERRORS.ASA.PARAM_ERROR_NO_NAMED_OPT_IN_ACCOUNT,
			"hi123"
		);
	});
});
