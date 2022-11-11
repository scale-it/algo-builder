import { assert } from "chai";

import { getProgram } from "../../../src";
import { RUNTIME_ERRORS } from "../../../src/errors/errors-list";
import { Interpreter } from "../../../src/interpreter/interpreter";
import { Op } from "../../../src/interpreter/opcode";
import {
	AcctParamsGet,
	Add,
	Addr,
	Addw,
	And,
	AppGlobalDel,
	AppGlobalGet,
	AppGlobalGetEx,
	AppGlobalPut,
	AppLocalDel,
	AppLocalGet,
	AppLocalGetEx,
	AppLocalPut,
	AppOptedIn,
	AppParamsGet,
	Arg,
	Assert,
	Balance,
	Base64Decode,
	BitLen,
	BitwiseAnd,
	BitwiseNot,
	BitwiseOr,
	BitwiseXor,
	Branch,
	BranchIfNotZero,
	BranchIfZero,
	Bsqrt,
	Btoi,
	Byte,
	Bytec,
	Callsub,
	Concat,
	Cover,
	Dig,
	Div,
	DivModw,
	Divw,
	Dup,
	Dup2,
	EcdsaPkDecompress,
	EcdsaPkRecover,
	EcdsaVerify,
	Ed25519verify,
	EqualTo,
	Err,
	Exp,
	Expw,
	Extract,
	Extract3,
	ExtractUint16,
	ExtractUint32,
	ExtractUint64,
	Gaid,
	Gaids,
	GetAssetDef,
	GetAssetHolding,
	GetBit,
	GetByte,
	Gitxn,
	Gitxna,
	Gitxnas,
	Gload,
	Gloads,
	Gloadss,
	Global,
	GreaterThan,
	GreaterThanEqualTo,
	Gtxn,
	Gtxna,
	Gtxns,
	Gtxnsa,
	Int,
	Intc,
	Itob,
	ITxnas,
	ITxnBegin,
	ITxnField,
	ITxnNext,
	ITxnSubmit,
	Keccak256,
	Label,
	Len,
	LessThan,
	LessThanEqualTo,
	Load,
	Loads,
	MinBalance,
	Mod,
	Mul,
	Mulw,
	Not,
	NotEqualTo,
	Or,
	Pop,
	Pragma,
	PushBytes,
	PushInt,
	Retsub,
	Return,
	Select,
	SetBit,
	SetByte,
	Sha256,
	Sha512_256,
	Shl,
	Shr,
	Sqrt,
	Store,
	Stores,
	Sub,
	Substring,
	Substring3,
	Swap,
	Switch,
	Txn,
	Txna,
	Uncover,
} from "../../../src/interpreter/opcode-list";
import {
	AcctParamQueryFields,
	AppParamDefined,
	LogicSigMaxSize,
	MAX_UINT64,
	MaxTEALVersion,
	MIN_UINT64,
	TxFieldEnum
} from "../../../src/lib/constants";
import { opcodeFromSentence, parser, wordsFromLine } from "../../../src/parser/parser";
import { Runtime } from "../../../src/runtime";
import { ExecutionMode } from "../../../src/types";
import { useFixture } from "../../helpers/integration";
import { expectRuntimeError } from "../../helpers/runtime-errors";

const tealTestArg = "test-arg.teal";

// base64 case needs to be verified at the time of decoding
describe("Parser", function () {
	describe("Extract words from line", function () {
		it("should return correct words for addr", function () {
			let res = wordsFromLine("addr KAGKGFFKGKGFGLFFBSLFBJKSFB");
			const expected = ["addr", "KAGKGFFKGKGFGLFFBSLFBJKSFB"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("addr KAGKGFFKGKGFGLFFBSLFBJKSFB//comment here");
			assert.deepEqual(res, expected);

			res = wordsFromLine("addr KAGKGFFKGKGFGLFFBSLFBJKSFB       //comment here");
			assert.deepEqual(res, expected);

			res = wordsFromLine("addr              KAGKGFFKGKGFGLFFBSLFBJKSFB//comment here");
			assert.deepEqual(res, expected);

			res = wordsFromLine("      addr     KAGKGFFKGKGFGLFFBSLFBJKSFB//comment here       ");
			assert.deepEqual(res, expected);
		});

		it("should return correct words for byte base64", function () {
			let res = wordsFromLine("byte base64 BKBDKSKDK");
			let expected = ["byte", "base64", "BKBDKSKDK"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("byte base64(BKBDKSKDK)");
			expected = ["byte", "base64(BKBDKSKDK)"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("byte base64(BKBDKSKD/K)");
			expected = ["byte", "base64(BKBDKSKD/K)"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("byte base64(BKBDKSKDK//KBBJSKJB)");
			expected = ["byte", "base64(BKBDKSKDK//KBBJSKJB)"];

			assert.deepEqual(res, expected);

			// Ignore `//` present in () because it may be a valid base64, but ignore outer comments
			res = wordsFromLine("byte base64(BKBDKSKDK//KBBJSKJB) // comment here");
			expected = ["byte", "base64(BKBDKSKDK//KBBJSKJB)"];

			assert.deepEqual(res, expected);
		});

		it("should return correct words for byte base32", function () {
			let res = wordsFromLine("byte     base32       BKBDKSKDK//commenthere");
			let expected = ["byte", "base32", "BKBDKSKDK"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("      byte  base32(BKBDKSKDK) //comment");
			expected = ["byte", "base32(BKBDKSKDK)"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("byte b32(BKBDKSKDK)");
			expected = ["byte", "b32(BKBDKSKDK)"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("byte b32 BKBDKSKDK//comment");
			expected = ["byte", "b32", "BKBDKSKDK"];

			assert.deepEqual(res, expected);
		});

		it("should return correct words for byte string literal", function () {
			let res = wordsFromLine('byte "STRING LITERAL"');
			let expected = ["byte", '"STRING LITERAL"'];

			assert.deepEqual(res, expected);

			res = wordsFromLine('byte "STRING \\"NESTED STRING\\" END"');
			expected = ["byte", '"STRING \\"NESTED STRING\\" END"'];

			assert.deepEqual(res, expected);
		});

		it("should return correct words for int", function () {
			let res = wordsFromLine("int 123");
			const expected = ["int", "123"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("int 123//comment here");
			assert.deepEqual(res, expected);

			res = wordsFromLine("       int       123       //comment here");
			assert.deepEqual(res, expected);

			res = wordsFromLine("int 123 //comment here");
			assert.deepEqual(res, expected);
		});

		it("should return correct words for operators", function () {
			let res = wordsFromLine("+");
			let expected = ["+"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("  +//comment here");
			assert.deepEqual(res, expected);

			res = wordsFromLine("+ //comment here");
			assert.deepEqual(res, expected);

			res = wordsFromLine("         - //comment            here");
			expected = ["-"];
			assert.deepEqual(res, expected);

			res = wordsFromLine("- //comment here");
			assert.deepEqual(res, expected);

			res = wordsFromLine("/ //comment here");
			expected = ["/"];
			assert.deepEqual(res, expected);

			res = wordsFromLine("* //comment here");
			expected = ["*"];
			assert.deepEqual(res, expected);

			res = wordsFromLine("      *       //    comment     here");
			assert.deepEqual(res, expected);
		});

		// more edge cases
		// space before parentheses,
		// space after base64: base64 (xxx ), base64( xxx) ..
		it("should extract correct words from line", function () {
			let res = wordsFromLine("base64 (abcd)");
			let expected = ["base64", "(abcd)"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("base64 (abcd )");
			expected = ["base64", "(abcd", ")"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("base64( abcd)");
			expected = ["base64(", "abcd)"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("base64(ab cd)");
			expected = ["base64(ab", "cd)"];

			assert.deepEqual(res, expected);

			res = wordsFromLine('base64 "ab cd"');
			expected = ["base64", '"ab cd"'];

			assert.deepEqual(res, expected);
		});

		it("should extract correct words from line", function () {
			let res = wordsFromLine("arg 1//comment here");
			let expected = ["arg", "1"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("arg_0// comment // comment // here");
			expected = ["arg_0"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("//comment int 2");
			expected = [];

			assert.deepEqual(res, expected);

			res = wordsFromLine("         txn             LastValid       // comment here");
			expected = ["txn", "LastValid"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("     ed25519verify     // here");
			expected = ["ed25519verify"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("/");
			expected = ["/"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("//");
			expected = [];

			assert.deepEqual(res, expected);

			res = wordsFromLine("!//");
			expected = ["!"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("!=//");
			expected = ["!="];

			assert.deepEqual(res, expected);

			res = wordsFromLine("%//here");
			expected = ["%"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("|//");
			expected = ["|"];

			assert.deepEqual(res, expected);
		});

		it("should extract correct stateful words", function () {
			let res = wordsFromLine("app_opted_in//comment here");
			let expected = ["app_opted_in"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("          app_local_get     // comment here");
			expected = ["app_local_get"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("          app_global_get_ex     // comment here");
			expected = ["app_global_get_ex"];

			assert.deepEqual(res, expected);

			res = wordsFromLine("  balance     // comment here");
			expected = ["balance"];

			assert.deepEqual(res, expected);
		});
	});

	describe("Opcode Objects from words", function () {
		let interpreter: Interpreter;
		beforeEach(function () {
			interpreter = new Interpreter();
			interpreter.tealVersion = MaxTEALVersion;
			interpreter.runtime = new Runtime([]);
		});

		it("should return correct opcode object for '+'", function () {
			const res = opcodeFromSentence(["+"], 1, interpreter, ExecutionMode.SIGNATURE);
			const expected = new Add([], 1);

			assert.deepEqual(res, expected);
		});

		it("should throw error for wrong field length for '+'", function () {
			expectRuntimeError(
				() => opcodeFromSentence(["+", "+"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);
		});

		it("should return correct opcode object for '-'", function () {
			const res = opcodeFromSentence(["-"], 1, interpreter, ExecutionMode.SIGNATURE);
			const expected = new Sub([], 1);

			assert.deepEqual(res, expected);
		});

		it("should throw error for wrong field length for '-'", function () {
			expectRuntimeError(
				() => opcodeFromSentence(["-", "-"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);
		});

		it("should return correct opcode object for '/'", function () {
			const res = opcodeFromSentence(["/"], 1, interpreter, ExecutionMode.SIGNATURE);
			const expected = new Div([], 1);

			assert.deepEqual(res, expected);
		});

		it("should throw error for wrong field length for '/'", function () {
			expectRuntimeError(
				() => opcodeFromSentence(["/", "/"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);
		});

		it("should return correct opcode object for '*'", function () {
			const res = opcodeFromSentence(["*"], 1, interpreter, ExecutionMode.SIGNATURE);
			const expected = new Mul([], 1);

			assert.deepEqual(res, expected);
		});

		it("should throw error for wrong field length for '*'", function () {
			expectRuntimeError(
				() => opcodeFromSentence(["*", "*"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);
		});

		it("should return correct opcode object for 'addr'", function () {
			const address = "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE";
			const res = opcodeFromSentence(
				["addr", address],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			const expected = new Addr([address], 1);

			assert.deepEqual(res, expected);
		});

		it("should throw error for wrong field length for 'addr'", function () {
			expectRuntimeError(
				() => opcodeFromSentence(["addr"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);
		});

		it("should throw error for invalid address for 'addr'", function () {
			expectRuntimeError(
				() => opcodeFromSentence(["addr", "AKGH12"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.INVALID_ADDR
			);
		});

		it("can use prefix 0x(hex) with 'int'", function () {
			const valueInHex = "0x02";
			const res = opcodeFromSentence(
				["int", valueInHex],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			const expected = new Int(["2"], 1);
			assert.deepEqual(res, expected);
		});

		it("can use prefix 0(oct) with 'int'", function () {
			const valueInHex = "010";
			const res = opcodeFromSentence(
				["int", valueInHex],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			const expected = new Int(["8"], 1);
			assert.deepEqual(res, expected);
		});

		it("should return correct opcode object for 'int'", function () {
			const value = "812546821";
			const res = opcodeFromSentence(["int", value], 1, interpreter, ExecutionMode.SIGNATURE);
			const expected = new Int([value], 1);

			assert.deepEqual(res, expected);
		});

		it("should work when int arg is zero", function () {
			const value = "0";
			const res = opcodeFromSentence(["int", value], 1, interpreter, ExecutionMode.SIGNATURE);
			const expected = new Int([value], 1);

			assert.deepEqual(res, expected);
		});

		it("should throw error for wrong field length for 'int'", function () {
			expectRuntimeError(
				() => opcodeFromSentence(["int"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);
		});

		it("should throw error for invalid number for 'int'", function () {
			expectRuntimeError(
				() => opcodeFromSentence(["int", "123A12"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			);

			// for dec format
			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["int", String(MAX_UINT64 + 5n)],
						1,
						interpreter,
						ExecutionMode.SIGNATURE
					),
				RUNTIME_ERRORS.TEAL.UINT64_OVERFLOW
			);

			// for hex format
			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["int", "0x" + (MAX_UINT64 + 5n).toString(16)],
						1,
						interpreter,
						ExecutionMode.SIGNATURE
					),
				RUNTIME_ERRORS.TEAL.UINT64_OVERFLOW
			);

			// for oct format
			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["int", "0" + (MAX_UINT64 + 5n).toString(8)],
						1,
						interpreter,
						ExecutionMode.SIGNATURE
					),
				RUNTIME_ERRORS.TEAL.UINT64_OVERFLOW
			);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["int", String(MIN_UINT64 - 5n)],
						1,
						interpreter,
						ExecutionMode.SIGNATURE
					),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			);
		});

		it("should return correct label", function () {
			const res = opcodeFromSentence(["label:"], 1, interpreter, ExecutionMode.SIGNATURE);
			const expected = new Label(["label:"], 1);

			assert.deepEqual(res, expected);
		});

		it("should throw error if wrong label is used", function () {
			expectRuntimeError(
				() => opcodeFromSentence(["substring:"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.INVALID_LABEL
			);
		});

		it("should return correct objects for `txn`", function () {
			let res = opcodeFromSentence(["txn", TxFieldEnum.Fee], 1, interpreter, ExecutionMode.SIGNATURE);
			let expected = new Txn([TxFieldEnum.Fee], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(
				["txn", TxFieldEnum.Accounts, "1"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			expected = new Txn([TxFieldEnum.Accounts, "1"], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(
				["txn", TxFieldEnum.ApplicationArgs, "0"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			expected = new Txn([TxFieldEnum.ApplicationArgs, "0"], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(["txn", TxFieldEnum.Fee, TxFieldEnum.Fee], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			expectRuntimeError(
				() => opcodeFromSentence(["txn", "fee"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.UNKNOWN_TRANSACTION_FIELD
			);
		});

		it("should return correct object for `gtxn`", function () {
			let res = opcodeFromSentence(
				["gtxn", "0", TxFieldEnum.Fee],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			let expected = new Gtxn(["0", TxFieldEnum.Fee], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(
				["gtxn", "0", TxFieldEnum.ApplicationArgs, "0"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			expected = new Gtxn(["0", TxFieldEnum.ApplicationArgs, "0"], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() => opcodeFromSentence(["gtxn", "1"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			expectRuntimeError(
				() =>
					opcodeFromSentence(["gtxn", "1AA", TxFieldEnum.Fee], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			);
		});

		it("should return correct object for `txna`", function () {
			let res = opcodeFromSentence(
				["txna", TxFieldEnum.Accounts, "0"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			let expected = new Txna([TxFieldEnum.Accounts, "0"], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(
				["txna", TxFieldEnum.ApplicationArgs, "2"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			expected = new Txna([TxFieldEnum.ApplicationArgs, "2"], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() => opcodeFromSentence(["txna", TxFieldEnum.Fee, "2"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.INVALID_OP_ARG
			);

			expectRuntimeError(
				() => opcodeFromSentence(["txna", "2"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			expectRuntimeError(
				() => opcodeFromSentence(["txna", TxFieldEnum.Fee, "A"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			);
		});

		it("should return correct object for `gtxna`", function () {
			let res = opcodeFromSentence(
				["gtxna", "1", TxFieldEnum.Accounts, "1"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			let expected = new Gtxna(["1", TxFieldEnum.Accounts, "1"], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(
				["gtxna", "1", TxFieldEnum.ApplicationArgs, "4"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			expected = new Gtxna(["1", TxFieldEnum.ApplicationArgs, "4"], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["gtxna", "1", TxFieldEnum.Fee, "4"],
						1,
						interpreter,
						ExecutionMode.SIGNATURE
					),
				RUNTIME_ERRORS.TEAL.INVALID_OP_ARG
			);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["gtxna", "1", "2", "3", "4"],
						1,
						interpreter,
						ExecutionMode.SIGNATURE
					),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["gtxna", "1AB", TxFieldEnum.Fee, "4"],
						1,
						interpreter,
						ExecutionMode.SIGNATURE
					),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			);
		});

		it("should return correct objects for `global`", function () {
			let res = opcodeFromSentence(
				["global", "MinTxnFee"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			let expected = new Global(["MinTxnFee"], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(
				["global", "MinBalance"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			expected = new Global(["MinBalance"], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(
				["global", "MaxTxnLife"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			expected = new Global(["MaxTxnLife"], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(
				["global", "ZeroAddress"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			expected = new Global(["ZeroAddress"], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(
				["global", "GroupSize"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			expected = new Global(["GroupSize"], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(
				["global", "LogicSigVersion"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			expected = new Global(["LogicSigVersion"], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(["global", "Round"], 1, interpreter, ExecutionMode.SIGNATURE);
			expected = new Global(["Round"], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(
				["global", "LatestTimestamp"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			expected = new Global(["LatestTimestamp"], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(
				["global", "CurrentApplicationID"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			expected = new Global(["CurrentApplicationID"], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(
				["global", "CreatorAddress"],
				1,
				interpreter,
				ExecutionMode.SIGNATURE
			);
			expected = new Global(["CreatorAddress"], 1, interpreter);
			assert.deepEqual(res, expected);

			res = opcodeFromSentence(["global", "GroupID"], 1, interpreter, ExecutionMode.SIGNATURE);
			expected = new Global(["GroupID"], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["global", "MinTxnFee", "MinTxnFee"],
						1,
						interpreter,
						ExecutionMode.SIGNATURE
					),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			expectRuntimeError(
				() =>
					opcodeFromSentence(["global", "mintxnfee"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
			);

			expectRuntimeError(
				() =>
					opcodeFromSentence(["global", "minbalance"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
			);

			expectRuntimeError(
				() =>
					opcodeFromSentence(["global", "maxtxnlife"], 1, interpreter, ExecutionMode.SIGNATURE),
				RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
			);
		});

		it("should return correct opcodes for `Balance` and `Asset` opcodes", function () {
			let res = opcodeFromSentence(["balance"], 1, interpreter, ExecutionMode.APPLICATION);
			let expected = new Balance([], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() => opcodeFromSentence(["balance", "1"], 1, interpreter, ExecutionMode.APPLICATION),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			res = opcodeFromSentence(
				["asset_holding_get", TxFieldEnum.AssetBalance],
				1,
				interpreter,
				ExecutionMode.APPLICATION
			);
			expected = new GetAssetHolding([TxFieldEnum.AssetBalance], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["asset_holding_get", TxFieldEnum.AssetBalance, TxFieldEnum.AssetFrozen],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			res = opcodeFromSentence(
				["asset_params_get", TxFieldEnum.AssetTotal],
				1,
				interpreter,
				ExecutionMode.APPLICATION
			);
			expected = new GetAssetDef([TxFieldEnum.AssetTotal], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["asset_params_get", TxFieldEnum.AssetTotal, "123"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["asset_params_get", TxFieldEnum.AssetCreator, "123"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);
		});

		it("TEALv5: should throw error for Asset Creator if LogicSigVersion < 5", function () {
			interpreter.tealVersion = 4;
			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["asset_params_get", TxFieldEnum.AssetCreator],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					),
				RUNTIME_ERRORS.TEAL.UNKNOWN_ASSET_FIELD
			);
		});

		it("should return correct opcodes for Stateful opcodes", function () {
			let res = opcodeFromSentence(["app_opted_in"], 1, interpreter, ExecutionMode.APPLICATION);
			let expected = new AppOptedIn([], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["app_opted_in", "12", "123"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			res = opcodeFromSentence(["app_local_get"], 1, interpreter, ExecutionMode.APPLICATION);
			expected = new AppLocalGet([], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["app_local_get", "123"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			res = opcodeFromSentence(["app_local_get_ex"], 1, interpreter, ExecutionMode.APPLICATION);
			expected = new AppLocalGetEx([], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["app_local_get_ex", "22", "123"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			res = opcodeFromSentence(["app_global_get"], 1, interpreter, ExecutionMode.APPLICATION);
			expected = new AppGlobalGet([], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["app_global_get", "12", "3"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			res = opcodeFromSentence(
				["app_global_get_ex"],
				1,
				interpreter,
				ExecutionMode.APPLICATION
			);
			expected = new AppGlobalGetEx([], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["app_global_get_ex", "4"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			res = opcodeFromSentence(["app_local_put"], 1, interpreter, ExecutionMode.APPLICATION);
			expected = new AppLocalPut([], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["app_local_put", "1223"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			res = opcodeFromSentence(["app_global_put"], 1, interpreter, ExecutionMode.APPLICATION);
			expected = new AppGlobalPut([], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["app_global_put", "123"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			res = opcodeFromSentence(["app_local_del"], 1, interpreter, ExecutionMode.APPLICATION);
			expected = new AppLocalDel([], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(["app_local_del", "3"], 1, interpreter, ExecutionMode.APPLICATION),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);

			res = opcodeFromSentence(["app_global_del"], 1, interpreter, ExecutionMode.APPLICATION);
			expected = new AppGlobalDel([], 1, interpreter);
			assert.deepEqual(res, expected);

			expectRuntimeError(
				() =>
					opcodeFromSentence(
						["app_global_del", "45"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);
		});

		describe("should return correct opcodes for tealv3 ops", function () {
			it("assert", function () {
				const res = opcodeFromSentence(["assert"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Assert([], 1);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["assert", "1234"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("pushint", function () {
				const res = opcodeFromSentence(
					["pushint", "345"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new PushInt(["345"], 1);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["pushint", "345", "456"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);

				expectRuntimeError(
					// Int Constants(eg. NoOp) works with int x
					() =>
						opcodeFromSentence(["pushint", "NoOp"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.INVALID_TYPE
				);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["pushint", (MAX_UINT64 + 10n).toString()],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.UINT64_OVERFLOW
				);
			});

			it("pushbytes", function () {
				const res = opcodeFromSentence(
					["pushbytes", `"Algorand"`],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new PushBytes([`"Algorand"`], 1);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["pushbytes", `"Algorand"`, `"Blockchain"`],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["pushbytes", `0x250001000192CD0000002F6D6E742F72`],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.UNKOWN_DECODE_TYPE
				);
			});

			it("swap", function () {
				const res = opcodeFromSentence(["swap"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Swap([], 1);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["swap", "xyz"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("txn fields", function () {
				let res = opcodeFromSentence(
					["txn", TxFieldEnum.Assets, "1"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				let expected = new Txn([TxFieldEnum.Assets, "1"], 1, interpreter);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["txn", TxFieldEnum.Assets, "0", "1"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["txn", TxFieldEnum.Assets, "random-string"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.INVALID_TYPE
				);

				res = opcodeFromSentence(
					["txn", TxFieldEnum.Applications, "0"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				expected = new Txn([TxFieldEnum.Applications, "0"], 1, interpreter);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["txn", TxFieldEnum.Applications, "0", "11"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["txn", TxFieldEnum.Applications, "random-string"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.INVALID_TYPE
				);

				res = opcodeFromSentence(
					["txn", "NumAssets"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				expected = new Txn(["NumAssets"], 1, interpreter);
				assert.deepEqual(res, expected);

				res = opcodeFromSentence(
					["txn", TxFieldEnum.GlobalNumUint],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				expected = new Txn([TxFieldEnum.GlobalNumUint], 1, interpreter);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["txn", "NumAssets", "0"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["txn", TxFieldEnum.GlobalNumUint, "0"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("getbit", function () {
				const res = opcodeFromSentence(["getbit"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new GetBit([], 1);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["getbit", "1234"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("setbit", function () {
				const res = opcodeFromSentence(["setbit"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new SetBit([], 1);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["setbit", "1234"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("getbyte", function () {
				const res = opcodeFromSentence(["getbyte"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new GetByte([], 1);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["getbyte", "1234"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("setbyte", function () {
				const res = opcodeFromSentence(["setbyte"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new SetByte([], 1);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["setbyte", "1234"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("dig", function () {
				const res = opcodeFromSentence(["dig", "2"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Dig(["2"], 1);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["dig", "xyz"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.INVALID_TYPE
				);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["dig", "2", "3"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("select", function () {
				const res = opcodeFromSentence(["select"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Select([], 1);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["select", "xyz"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("gtxns", function () {
				const res = opcodeFromSentence(
					["gtxns", TxFieldEnum.Amount],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new Gtxns([TxFieldEnum.Amount], 1, interpreter);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["gtxns", "amount"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.UNKNOWN_TRANSACTION_FIELD
				);

				// invalid because index 0 is fetched from top of stack
				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["gtxns", "0", TxFieldEnum.Amount],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("gtxnsa", function () {
				const res = opcodeFromSentence(
					["gtxnsa", TxFieldEnum.ApplicationArgs, "0"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new Gtxnsa([TxFieldEnum.ApplicationArgs, "0"], 1, interpreter);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["gtxnsa", "applicationargs", "0"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.INVALID_OP_ARG
				);

				// invalid because index 0 is fetched from top of stack
				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["gtxnsa", "0", TxFieldEnum.ApplicationArgs, "0"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("min_balance", function () {
				const res = opcodeFromSentence(
					["min_balance"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new MinBalance([], 1, interpreter);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["min_balance", "xyz"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});
		});

		describe("should return correct opcodes for tealv4 ops", function () {
			it("gload", function () {
				const res = opcodeFromSentence(
					["gload", "0", "1"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new Gload(["0", "1"], 1, interpreter);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["gload", "one", "1"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.INVALID_TYPE
				);

				expectRuntimeError(
					() => opcodeFromSentence(["gload", "0"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("gloads", function () {
				const res = opcodeFromSentence(
					["gloads", "0"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new Gloads(["0"], 1, interpreter);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["gloads", "one"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.INVALID_TYPE
				);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["gloads", "0", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("callsub", function () {
				const res = opcodeFromSentence(
					["callsub", "label"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new Callsub(["label"], 1, interpreter);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["callsub", "label1", "label2"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("retsub", function () {
				const res = opcodeFromSentence(["retsub"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Retsub([], 1, interpreter);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["retsub", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("gaid", function () {
				const res = opcodeFromSentence(
					["gaid", "2"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new Gaid(["2"], 1, interpreter);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["gaid", "1", "2"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("gaids", function () {
				const res = opcodeFromSentence(["gaids"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Gaids([], 1, interpreter);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["gaids", "1", "2"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("divmodw", function () {
				const res = opcodeFromSentence(["divmodw"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new DivModw([], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["divmodw", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("exp", function () {
				const res = opcodeFromSentence(["exp"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Exp([], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["exp", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("expw", function () {
				const res = opcodeFromSentence(["expw"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Expw([], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["expw", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("shl", function () {
				const res = opcodeFromSentence(["shl"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Shl([], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["shl", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("shr", function () {
				const res = opcodeFromSentence(["shr"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Shr([], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["shr", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("sqrt", function () {
				const res = opcodeFromSentence(["sqrt"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Sqrt([], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["sqrt", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("bitlen", function () {
				const res = opcodeFromSentence(["bitlen"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new BitLen([], 1);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["bitlen", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("bsqrt", function () {
				const res = opcodeFromSentence(["bsqrt"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Sqrt([], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["bsqrt", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});
		});

		describe("should return correct opcodes for tealv5 ops", function () {
			it("extract", function () {
				const res = opcodeFromSentence(
					["extract", "1", "2"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new Extract(["1", "2"], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["extract", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("extract3", function () {
				const res = opcodeFromSentence(["extract3"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Extract3([], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["extract3", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("extract_uint16", function () {
				const res = opcodeFromSentence(
					["extract_uint16"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new ExtractUint16([], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["extract_uint16", "1"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("extract_uint32", function () {
				const res = opcodeFromSentence(
					["extract_uint32"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new ExtractUint32([], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["extract_uint32", "1"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("extract_uint64", function () {
				const res = opcodeFromSentence(
					["extract_uint64"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new ExtractUint64([], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["extract_uint64", "1"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});
		});

		describe("Tealv5: ECDSA opcodes", function () {
			it("ecdsa_verify", function () {
				const res = opcodeFromSentence(
					["ecdsa_verify", "0"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new EcdsaVerify(["0"], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["ecdsa_verify"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("ecdsa_pk_decompress", function () {
				const res = opcodeFromSentence(
					["ecdsa_pk_decompress", "0"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new EcdsaPkDecompress(["0"], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["ecdsa_pk_decompress"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("ecdsa_pk_recover", function () {
				const res = opcodeFromSentence(
					["ecdsa_pk_recover", "0"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new EcdsaPkRecover(["0"], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["ecdsa_pk_recover"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});
		});

		describe("should return correct opcodes for tealv5 ops", function () {
			it("loads", function () {
				const res = opcodeFromSentence(["loads"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Loads([], 1, interpreter);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["loads", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("stores", function () {
				const res = opcodeFromSentence(["stores"], 1, interpreter, ExecutionMode.APPLICATION);
				const expected = new Stores([], 1, interpreter);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() => opcodeFromSentence(["stores", "1"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("cover", function () {
				const res = opcodeFromSentence(
					["cover", "1"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new Cover(["1"], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(["cover", "1", "2"], 1, interpreter, ExecutionMode.APPLICATION),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("uncover", function () {
				const res = opcodeFromSentence(
					["uncover", "1"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new Uncover(["1"], 1);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["uncover", "1", "2"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("itxn_begin", function () {
				const res = opcodeFromSentence(
					["itxn_begin"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new ITxnBegin([], 1, interpreter);

				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["itxn_begin", "exxtra"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("itxn_field f", function () {
				let res = opcodeFromSentence(
					["itxn_field", "Sender"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				let expected = new ITxnField(["Sender"], 1, interpreter);
				assert.deepEqual(res, expected);

				res = opcodeFromSentence(
					["itxn_field", TxFieldEnum.FreezeAsset],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				expected = new ITxnField([TxFieldEnum.FreezeAsset], 1, interpreter);
				assert.deepEqual(res, expected);

				res = opcodeFromSentence(
					["itxn_field", TxFieldEnum.ConfigAssetTotal],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				expected = new ITxnField([TxFieldEnum.ConfigAssetTotal], 1, interpreter);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["itxn_field", "Sender", TxFieldEnum.Fee],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("itxn_submit", function () {
				const res = opcodeFromSentence(
					["itxn_submit"],
					1,
					interpreter,
					ExecutionMode.APPLICATION
				);
				const expected = new ITxnSubmit([], 1, interpreter);
				assert.deepEqual(res, expected);

				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["itxn_submit", "exxtra"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});

			it("app_get_params i", function () {
				const appParams = AppParamDefined[interpreter.tealVersion];
				appParams.forEach((appParam: string) => {
					const res = opcodeFromSentence(
						["app_params_get", appParam],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					);
					const expected = new AppParamsGet([appParam], 1, interpreter);
					assert.deepEqual(res, expected);
				});
				expectRuntimeError(
					() =>
						opcodeFromSentence(
							["app_params_get", "unknow", "hello"],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						),
					RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
				);
			});
		});

		describe("opcodes for tealv6 ops", function () {
			this.beforeEach(function () {
				interpreter.tealVersion = 6;
			});

			describe("gloadss opcode", function () {
				it("should succeed create gloadss", function () {
					const res = opcodeFromSentence(
						["gloadss"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					);
					const expected = new Gloadss([], 1, interpreter);

					assert.deepEqual(res, expected);
				});
				it("Should fail: create opcode with invalid parameters", function () {
					expectRuntimeError(
						() =>
							opcodeFromSentence(["gloadss", "1"], 1, interpreter, ExecutionMode.APPLICATION),
						RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
					);

					expectRuntimeError(
						() => opcodeFromSentence(["gloadss"], 1, interpreter, ExecutionMode.SIGNATURE),
						RUNTIME_ERRORS.TEAL.EXECUTION_MODE_NOT_VALID
					);
				});
			});

			describe("acct_params_get Opcode", function () {
				it("Should succeed: create new acct_params_get opcode", function () {
					Object.keys(AcctParamQueryFields).forEach((appParam: string) => {
						const res = opcodeFromSentence(
							["acct_params_get", appParam],
							1,
							interpreter,
							ExecutionMode.APPLICATION
						);
						const expected = new AcctParamsGet([appParam], 1, interpreter);
						assert.deepEqual(res, expected);
					});
				});
				it("Should fail: create acct_params_get opcode with invalid parameter", function () {
					expectRuntimeError(
						() =>
							opcodeFromSentence(
								["acct_params_get", "unknow", "hello"],
								1,
								interpreter,
								ExecutionMode.APPLICATION
							),
						RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
					);
				});
			});

			describe("itxn_next opcode", function () {
				it("Should succeed: create new itxn_next opcode", function () {
					// can parse opcode
					const res = opcodeFromSentence(
						["itxn_next"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					);
					const expected = new ITxnNext([], 1, interpreter);
					assert.deepEqual(res, expected);
				});
				it("Should fail: Create itxn_next with invalid parameters", function () {
					expectRuntimeError(
						() =>
							opcodeFromSentence(
								["itxn_next", "unknowfield"],
								1,
								interpreter,
								ExecutionMode.APPLICATION
							),
						RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
					);
				});
			});

			describe("gitxn Opcode", function () {
				it("Should succeed: create new gitxn opcode", function () {
					let res = opcodeFromSentence(
						["gitxn", "0", TxFieldEnum.Fee],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					);
					let expected = new Gitxn(["0", TxFieldEnum.Fee], 1, interpreter);
					assert.deepEqual(res, expected);

					res = opcodeFromSentence(
						["gitxn", "0", TxFieldEnum.ApplicationArgs, "0"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					);
					expected = new Gitxn(["0", TxFieldEnum.ApplicationArgs, "0"], 1, interpreter);
					assert.deepEqual(res, expected);
				});
				it("Should fail: create gitxn opcode with invalid parameters", function () {
					expectRuntimeError(
						() => opcodeFromSentence(["gitxn", "1"], 1, interpreter, ExecutionMode.APPLICATION),
						RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
					);

					expectRuntimeError(
						() =>
							opcodeFromSentence(
								["gitxn", "1AA", TxFieldEnum.Fee],
								1,
								interpreter,
								ExecutionMode.APPLICATION
							),
						RUNTIME_ERRORS.TEAL.INVALID_TYPE
					);
				});
			});

			describe("gitxna Opcode", function () {
				it("Should succeed: create new gitxna opcode", function () {
					let res = opcodeFromSentence(
						["gitxna", "1", TxFieldEnum.Accounts, "1"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					);
					let expected = new Gitxna(["1", TxFieldEnum.Accounts, "1"], 1, interpreter);
					assert.deepEqual(res, expected);

					res = opcodeFromSentence(
						["gitxna", "1", TxFieldEnum.ApplicationArgs, "4"],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					);
					expected = new Gitxna(["1", TxFieldEnum.ApplicationArgs, "4"], 1, interpreter);
					assert.deepEqual(res, expected);
				});

				it("Should fail: create gitxna with invalid parameters", function () {
					expectRuntimeError(
						() =>
							opcodeFromSentence(
								["gitxna", "1", TxFieldEnum.Fee, "4"],
								1,
								interpreter,
								ExecutionMode.APPLICATION
							),
						RUNTIME_ERRORS.TEAL.INVALID_OP_ARG
					);

					expectRuntimeError(
						() =>
							opcodeFromSentence(
								["gitxna", "1", "2", "3", "4"],
								1,
								interpreter,
								ExecutionMode.APPLICATION
							),
						RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
					);

					expectRuntimeError(
						() =>
							opcodeFromSentence(
								["gitxna", "1AB", TxFieldEnum.Fee, "4"],
								1,
								interpreter,
								ExecutionMode.APPLICATION
							),
						RUNTIME_ERRORS.TEAL.INVALID_TYPE
					);
				});
			});

			describe("gitxnas Opcode", function () {
				it("Should succeed: create new gitxnas opcode", function () {
					let res = opcodeFromSentence(
						["gitxnas", "1", TxFieldEnum.Accounts],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					);
					let expected = new Gitxnas(["1", TxFieldEnum.Accounts], 1, interpreter);
					assert.deepEqual(res, expected);

					res = opcodeFromSentence(
						["gitxnas", "1", TxFieldEnum.ApplicationArgs],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					);
					expected = new Gitxnas(["1", TxFieldEnum.ApplicationArgs], 1, interpreter);
					assert.deepEqual(res, expected);
				});

				it("Should fail: create gitxnas with invalid parameters", function () {
					expectRuntimeError(
						() =>
							opcodeFromSentence(
								["gitxnas", "1", TxFieldEnum.Fee],
								1,
								interpreter,
								ExecutionMode.APPLICATION
							),
						RUNTIME_ERRORS.TEAL.INVALID_OP_ARG
					);

					expectRuntimeError(
						() =>
							opcodeFromSentence(
								["gitxnas", "1", "2", "3"],
								1,
								interpreter,
								ExecutionMode.APPLICATION
							),
						RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
					);

					expectRuntimeError(
						() =>
							opcodeFromSentence(
								["gitxnas", "1AB", TxFieldEnum.Fee],
								1,
								interpreter,
								ExecutionMode.APPLICATION
							),
						RUNTIME_ERRORS.TEAL.INVALID_TYPE
					);
				});
			});

			describe("itxnas opcode", function () {
				it("Should succeed: create new itxnas opcode", function () {
					// can parse opcode
					const res = opcodeFromSentence(
						["itxnas", TxFieldEnum.Accounts],
						1,
						interpreter,
						ExecutionMode.APPLICATION
					);
					const expected = new ITxnas([TxFieldEnum.Accounts], 1, interpreter);
					assert.deepEqual(res, expected);
				});

				it("Should fail: create opcode with invalid parameters", function () {
					expectRuntimeError(
						() => opcodeFromSentence(["itxnas"], 1, interpreter, ExecutionMode.APPLICATION),
						RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
					);

					expectRuntimeError(
						() =>
							opcodeFromSentence(["itxnas", TxFieldEnum.Fee], 1, interpreter, ExecutionMode.APPLICATION),
						RUNTIME_ERRORS.TEAL.INVALID_OP_ARG
					);
				});
			});
		});
	});

	const cryptoFile = "test-crypto.teal";
	describe("Opcodes list from TEAL file", function () {
		useFixture("teal-files");

		let interpreter: Interpreter;
		beforeEach(function () {
			interpreter = new Interpreter();
			interpreter.runtime = new Runtime([]);
			interpreter.tealVersion = 2;
		});

		function loadProgram(filename: string, mode = ExecutionMode.SIGNATURE): Op[] {
			return parser(getProgram(filename), mode, interpreter);
		}

		it("Supported pragma version 6", function () {
			assert.doesNotThrow(() => loadProgram("test-pragma-v6.teal"));
		});

		it("Supported pragma version 7", function () {
			assert.doesNotThrow(() => loadProgram("test-pragma-v7.teal"));
		});

		it("Should fail if declare pragma greater than 8", function () {
			expectRuntimeError(
				() => loadProgram("test-pragma-invalid.teal"),
				RUNTIME_ERRORS.TEAL.PRAGMA_VERSION_ERROR
			);
		});

		it("Should return correct opcode list for '+'", async function () {
			let res = loadProgram("test-file-1.teal");
			const expected = [new Int(["1"], 1), new Int(["3"], 2), new Add([], 3)];
			assert.deepEqual(res, expected);

			const expect = [
				new Pragma(["version", "4"], 1, interpreter),
				new Int(["1"], 2),
				new Int(["3"], 3),
				new Add([], 4),
			];
			res = loadProgram("test-file-2.teal");
			assert.deepEqual(res, expect);
		});

		it("Should throw error if #pragma is not on 1st line", async function () {
			expectRuntimeError(
				() => loadProgram("test-pragma-1.teal"),
				RUNTIME_ERRORS.TEAL.PRAGMA_NOT_AT_FIRST_LINE
			);

			expectRuntimeError(
				() => loadProgram("test-pragma-2.teal"),
				RUNTIME_ERRORS.TEAL.PRAGMA_NOT_AT_FIRST_LINE
			);
		});

		it("Should return correct opcode list for '-'", async function () {
			const res = loadProgram("test-file-3.teal");
			const expected = [
				new Pragma(["version", "4"], 1, interpreter),
				new Int(["5"], 2),
				new Int(["3"], 3),
				new Sub([], 4),
			];

			assert.deepEqual(res, expected);
		});

		it("Should return correct opcode list for '/'", async function () {
			const res = loadProgram("test-file-4.teal");
			const expected = [
				new Pragma(["version", "4"], 1, interpreter),
				new Int(["6"], 2),
				new Int(["3"], 3),
				new Div([], 6),
			];

			assert.deepEqual(res, expected);
		});

		it("Should return correct opcode list for '*'", async function () {
			const res = loadProgram("test-file-5.teal");
			const expected = [
				new Pragma(["version", "4"], 1, interpreter),
				new Int(["5"], 4),
				new Int(["3"], 6),
				new Mul([], 10),
			];

			assert.deepEqual(res, expected);
		});

		it("Should return correct opcode list for 'addr'", async function () {
			const res = loadProgram("test-addr.teal");
			const expected = [
				new Pragma(["version", "4"], 1, interpreter),
				new Addr(["WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE"], 2),
			];

			assert.deepEqual(res, expected);
		});

		it("Should return correct opcode list for 'byte'", async function () {
			const res = loadProgram("test-byte.teal");
			const byte64 = "QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=";
			const byte32 = "MFRGGZDFMY======";

			const expected = [
				new Byte(["b64", byte64], 1),
				new Byte(["b64", byte64], 2),
				new Byte(["b64", byte64], 3),
				new Byte(["b64", byte64], 4),
				new Byte(["b32", byte32], 5),
				new Byte(["b32", byte32], 6),
				new Byte(["b32", byte32], 7),
				new Byte(["b32", byte32], 8),
			];

			assert.deepEqual(res, expected);
		});

		it("Should return correct opcode list for 'Len and Err'", async function () {
			const res = loadProgram("test-len-err.teal");
			const expected = [new Len([], 1), new Err([], 2)];

			assert.deepEqual(res, expected);
		});

		it("Should return correct opcode list for 'Bitwise'", async function () {
			const res = loadProgram("test-bitwise.teal");
			const expected = [
				new BitwiseOr([], 2),
				new BitwiseAnd([], 4),
				new BitwiseXor([], 6),
				new BitwiseNot([], 7),
			];

			assert.deepEqual(res, expected);
		});

		it("Should return correct opcode list for 'Mod'", async function () {
			const res = loadProgram("test-mod.teal");
			const expected = [new Int(["6"], 1), new Int(["3"], 2), new Mod([], 3)];

			assert.deepEqual(res, expected);
		});

		it("Should return correct opcode list for 'Arg'", async function () {
			interpreter.runtime = new Runtime([]);
			interpreter.runtime.ctx.args = [new Uint8Array(0)];

			const res = loadProgram(tealTestArg);
			const expected = [new Arg(["0"], 1, interpreter)];

			assert.deepEqual(res, expected);
		});

		it("Should return correct opcode list for 'Intc and Bytec'", async function () {
			interpreter.intcblock = [1n];
			interpreter.bytecblock = [new Uint8Array(0)];

			const res = loadProgram("test-int-bytec.teal");
			const expected = [new Intc(["0"], 1, interpreter), new Bytec(["0"], 2, interpreter)];

			assert.deepEqual(res, expected);
		});

		it("Should return correct opcode list for 'Store and Load'", async function () {
			interpreter.scratch = [1n];
			const res = loadProgram("test-store-load.teal");
			const expected = [new Store(["0"], 1, interpreter), new Load(["0"], 2, interpreter)];

			assert.deepEqual(res, expected);
		});

		it("Should return correct opcode list for 'Crypto opcodes'", async function () {
			const res = loadProgram(cryptoFile);
			const expected = [
				new Sha256([], 1, interpreter),
				new Keccak256([], 2, interpreter),
				new Sha512_256([], 3, interpreter),
				new Ed25519verify([], 4, interpreter),
			];
			assert.deepEqual(res, expected);
		});

		it("Should return correct opcode list for 'comparsions'", async function () {
			const res = loadProgram("test-compare.teal");
			const expected = [
				new LessThan([], 1),
				new GreaterThan([], 2),
				new LessThanEqualTo([], 3),
				new GreaterThanEqualTo([], 4),
				new And([], 5),
				new Or([], 6),
				new EqualTo([], 7),
				new NotEqualTo([], 8),
				new Not([], 9),
			];

			assert.deepEqual(res, expected);
		});

		it("Should return correct opcode list for 'all others'", async function () {
			const res = loadProgram("test-others.teal");
			const expected = [
				new Pragma(["version", "6"], 1, interpreter),
				new Itob([], 2),
				new Btoi([], 3),
				new Mulw([], 4),
				new Addw([], 5),
				new Pop([], 6),
				new Dup([], 7),
				new Dup2([], 8),
				new Concat([], 9),
				new Substring(["0", "4"], 10),
				new Substring3([], 11),
				new Divw([], 12),
			];
			assert.deepEqual(res, expected);
		});

		it("should return correct opcode list for 'b, bz, bnz'", async function () {
			const res = loadProgram("test-branch.teal");
			const expected = [
				new Branch(["label1"], 2, interpreter),
				new BranchIfZero(["label2"], 3, interpreter),
				new BranchIfNotZero(["label3"], 4, interpreter),
			];

			assert.deepEqual(res, expected);
		});

		it("should return correct opcode list for 'return'", async function () {
			const res = loadProgram("test-return.teal");
			const expected = [new Return([], 2, interpreter)];
			assert.deepEqual(res, expected);
		});

		it("should return correct opcode list for 'Label'", async function () {
			const res = loadProgram("test-label.teal");
			const expected = [new Label(["label:"], 2)];
			assert.deepEqual(res, expected);
		});

		it("should return correct opcode list for 'global'", async function () {
			const res = loadProgram("test-global.teal");
			const expected = [
				new Global(["MinTxnFee"], 3, interpreter),
				new Global(["MinBalance"], 4, interpreter),
				new Global(["MaxTxnLife"], 5, interpreter),
				new Global(["ZeroAddress"], 6, interpreter),
				new Global(["GroupSize"], 7, interpreter),
				new Global(["LogicSigVersion"], 8, interpreter),
				new Global(["Round"], 9, interpreter),
				new Global(["LatestTimestamp"], 10, interpreter),
				new Global(["CurrentApplicationID"], 11, interpreter),
			];

			assert.deepEqual(res, expected);
		});

		it("should return correct opcode list for `Stateful`", async function () {
			const res = loadProgram("test-stateful.teal", ExecutionMode.APPLICATION);
			const expected = [
				new Pragma(["version", "5"], 1, interpreter),
				new Balance([], 4, interpreter),
				new GetAssetHolding([TxFieldEnum.AssetBalance], 5, interpreter),
				new GetAssetDef([TxFieldEnum.AssetTotal], 6, interpreter),
				new AppOptedIn([], 8, interpreter),
				new AppLocalGet([], 9, interpreter),
				new AppLocalGetEx([], 10, interpreter),
				new AppGlobalGet([], 11, interpreter),
				new AppGlobalGetEx([], 12, interpreter),
				new AppLocalPut([], 13, interpreter),
				new AppGlobalPut([], 14, interpreter),
				new AppLocalDel([], 15, interpreter),
				new AppGlobalDel([], 16, interpreter),
				new Int(["10"], 17),
				new AppParamsGet(["AppCreator"], 18, interpreter),
			];
			assert.deepEqual(res, expected);
		});

		it("should return correct opcode list for `teal v6`", async function () {
			const res = loadProgram("teal-v6.teal", ExecutionMode.APPLICATION);
			const expected = [
				new Pragma(["version", "6"], 1, interpreter),
				new Divw([], 2),
				new Bsqrt([], 3),
				new Gloadss([], 4, interpreter),
				new AcctParamsGet(["AcctBalance"], 5, interpreter),
				new ITxnNext([], 6, interpreter),
				new Gitxn(["0", TxFieldEnum.Fee], 7, interpreter),
				new Gitxna(["1", TxFieldEnum.Accounts, "1"], 8, interpreter),
				new Gitxnas(["0", TxFieldEnum.Accounts], 9, interpreter),
				new ITxnas([TxFieldEnum.Accounts], 10, interpreter),
			];
			assert.deepEqual(res, expected);
		});

		it("should return correct opcode list for `teal v7`", async function () {
			const res = loadProgram("teal-v7.teal", ExecutionMode.APPLICATION);
			const expected = [
				new Pragma(["version", "7"], 1, interpreter),
				new Base64Decode(["URLEncoding"], 2),
			];
			assert.deepEqual(expected, res);
		});

		it("Should return correct opcode list for TEALv8", function () {
			const res = loadProgram("teal-v8.teal", ExecutionMode.APPLICATION);
			const expected = [
				new Pragma(["version", "8"], 1, interpreter),
				new Switch(["zero", "one"], 2, interpreter),
			];
			assert.deepEqual(expected, res);
		});
	});

	describe("Gas cost of Opcodes from TEAL file", function () {
		useFixture("teal-files");
		const file = "test-arg.teal"; // byte size 3

		let interpreter: Interpreter;
		beforeEach(function () {
			interpreter = new Interpreter();
		});

		it("Should return correct gas cost for 'Crypto opcodes' for tealversion 1", async function () {
			interpreter.tealVersion = 1; // by default the version is also 1

			let op = opcodeFromSentence(["sha256"], 1, interpreter, ExecutionMode.APPLICATION);
			assert.equal(interpreter.gas, 7);

			interpreter.gas = 0;
			op = opcodeFromSentence(["keccak256"], 2, interpreter, ExecutionMode.APPLICATION);
			assert.equal(interpreter.gas, 26);

			interpreter.gas = 0;
			op = opcodeFromSentence(["sha512_256"], 3, interpreter, ExecutionMode.APPLICATION);
			assert.equal(interpreter.gas, 9);

			interpreter.gas = 0;
			// eslint-disable-next-line
			op = opcodeFromSentence(["ed25519verify"], 4, interpreter, ExecutionMode.APPLICATION);
			assert.equal(interpreter.gas, 1900);

			interpreter.gas = 0;
			parser(getProgram(cryptoFile), ExecutionMode.SIGNATURE, interpreter);
			assert.equal(interpreter.gas, 1942); // 7 + 26 + 9 + 1900
		});

		it("Should return correct gas cost for 'Crypto opcodes' for tealversion 2", async function () {
			interpreter.tealVersion = 2;

			let op = opcodeFromSentence(["sha256"], 1, interpreter, ExecutionMode.APPLICATION);
			assert.equal(interpreter.gas, 35);

			interpreter.gas = 0;
			op = opcodeFromSentence(["keccak256"], 2, interpreter, ExecutionMode.APPLICATION);
			assert.equal(interpreter.gas, 130);

			interpreter.gas = 0;
			op = opcodeFromSentence(["sha512_256"], 3, interpreter, ExecutionMode.APPLICATION);
			assert.equal(interpreter.gas, 45);

			interpreter.gas = 0;
			// eslint-disable-next-line
			op = opcodeFromSentence(["ed25519verify"], 4, interpreter, ExecutionMode.APPLICATION);
			assert.equal(interpreter.gas, 1900);

			interpreter.gas = 0;
			parser(getProgram(cryptoFile), ExecutionMode.SIGNATURE, interpreter);
			assert.equal(interpreter.gas, 2110); // 35 + 130 + 45 + 1900
		});

		// note: cost for cryto ops for teal version 2, 3 are same
		it("Should return correct gas cost for 'Crypto opcodes' for tealversion 3", async function () {
			interpreter.tealVersion = 3;

			let op = opcodeFromSentence(["sha256"], 1, interpreter, ExecutionMode.APPLICATION);
			assert.equal(interpreter.gas, 35);

			interpreter.gas = 0;
			op = opcodeFromSentence(["keccak256"], 2, interpreter, ExecutionMode.APPLICATION);
			assert.equal(interpreter.gas, 130);

			interpreter.gas = 0;
			op = opcodeFromSentence(["sha512_256"], 3, interpreter, ExecutionMode.APPLICATION);
			assert.equal(interpreter.gas, 45);

			interpreter.gas = 0;
			// eslint-disable-next-line
			op = opcodeFromSentence(["ed25519verify"], 4, interpreter, ExecutionMode.APPLICATION);
			assert.equal(interpreter.gas, 1900);

			interpreter.gas = 0;
			parser(getProgram(cryptoFile), ExecutionMode.SIGNATURE, interpreter);
			assert.equal(interpreter.gas, 2110); // 35 + 130 + 45 + 1900
		});

		it("Should return correct gas cost for mix opcodes from teal files", async function () {
			let file = "test-file-1.teal";
			const mode = ExecutionMode.SIGNATURE;
			parser(getProgram(file), mode, interpreter);
			assert.equal(interpreter.gas, 3);

			interpreter.gas = 0;
			file = "test-file-3.teal";
			parser(getProgram(file), mode, interpreter);
			assert.equal(interpreter.gas, 3);

			interpreter.gas = 0;
			file = "test-file-4.teal";
			parser(getProgram(file), mode, interpreter);
			assert.equal(interpreter.gas, 3);

			interpreter.gas = 0;
			file = "test-label.teal";
			parser(getProgram(file), mode, interpreter);
			assert.equal(interpreter.gas, 0); // label has cost 0

			interpreter.gas = 0;
			file = "test-others.teal";
			parser(getProgram(file), mode, interpreter);
			assert.equal(interpreter.gas, 11);

			interpreter.gas = 0;
			file = "test-stateful.teal";
			parser(getProgram(file), ExecutionMode.APPLICATION, interpreter);
			assert.equal(interpreter.gas, 14);
		});

		it("Should throw error if total cost exceeds 20000", async function () {
			const file = "test-max-opcost.teal"; // has cost 22800
			expectRuntimeError(
				() => parser(getProgram(file), ExecutionMode.SIGNATURE, interpreter),
				RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED
			);
		});

		it("Should pass when (program size + args size) = LogicSigMaxSize", function () {
			interpreter.runtime = new Runtime([]);
			interpreter.runtime.ctx.args = [new Uint8Array(LogicSigMaxSize - 3)];

			assert.doesNotThrow(() =>
				parser(getProgram(tealTestArg), ExecutionMode.SIGNATURE, interpreter)
			);

			// verify lsig size
			assert.equal(Buffer.from(getProgram(tealTestArg), "base64").length, 3);
		});

		it("Should fail when (program size + args size) > LogicSigMaxSize", function () {
			interpreter.runtime = new Runtime([]);
			interpreter.runtime.ctx.args = [new Uint8Array(LogicSigMaxSize - 2)];

			expectRuntimeError(
				() => parser(getProgram(tealTestArg), ExecutionMode.SIGNATURE, interpreter),
				RUNTIME_ERRORS.TEAL.MAX_LEN_EXCEEDED
			);
			// verify lsig size
			assert.equal(Buffer.from(getProgram(tealTestArg), "base64").length, 3);
		});
	});
});
