import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../../src/errors/errors-list";
import { Interpreter } from "../../../src/interpreter/interpreter";
import {
  Add, Addr, Addw, And, AppGlobalDel, AppGlobalGet, AppGlobalGetEx,
  AppGlobalPut, AppLocalDel, AppLocalGet, AppLocalGetEx, AppLocalPut,
  AppOptedIn, Arg, Balance, BitwiseAnd, BitwiseNot, BitwiseOr, BitwiseXor,
  Branch, BranchIfNotZero, BranchIfZero, Btoi, Byte, Bytec, Concat, Div,
  Dup, Dup2, Ed25519verify, EqualTo, Err, GetAssetDef, GetAssetHolding,
  Global, GreaterThan, GreaterThanEqualTo, Gtxn, Gtxna, Int, Intc, Itob,
  Keccak256, Label, Len, LessThan, LessThanEqualTo, Load, Mod, Mul, Mulw,
  Not, NotEqualTo, Or, Pop, Pragma, Return, Sha256, Sha512_256, Store,
  Sub, Substring, Substring3, Txn, Txna
} from "../../../src/interpreter/opcode-list";
import { MAX_UINT64, MIN_UINT64 } from "../../../src/lib/constants";
import { opcodeFromSentence, parser, wordsFromLine } from "../../../src/parser/parser";
import { Runtime } from "../../../src/runtime";
import { ExecutionMode } from "../../../src/types";
import { getProgram } from "../../helpers/files";
import { useFixture } from "../../helpers/integration";
import { expectRuntimeError } from "../../helpers/runtime-errors";

// base64 case needs to be verified at the time of decoding
describe("Parser", function () {
  describe("Extract words from line", () => {
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

    it("should return correct words for byte base64", () => {
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

    it("should return correct words for byte base32", () => {
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

    it("should return correct words for byte string literal", () => {
      let res = wordsFromLine('byte "STRING LITERAL"');
      let expected = ["byte", "\"STRING LITERAL\""];

      assert.deepEqual(res, expected);

      res = wordsFromLine('byte "STRING \\"NESTED STRING\\" END"');
      expected = ["byte", "\"STRING \\\"NESTED STRING\\\" END\""];

      assert.deepEqual(res, expected);
    });

    it("should return correct words for int", () => {
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

    it("should return correct words for operators", () => {
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
    it("should extract correct words from line", () => {
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

      res = wordsFromLine("base64 \"ab cd\"");
      expected = ["base64", "\"ab cd\""];

      assert.deepEqual(res, expected);
    });

    it("should extract correct words from line", () => {
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

    it("should extract correct stateful words", () => {
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

  describe("Opcode Objects from words", () => {
    let interpreter: Interpreter;
    beforeEach(function () {
      interpreter = new Interpreter();
      interpreter.tealVersion = 2;
    });

    it("should return correct opcode object for '+'", () => {
      const res = opcodeFromSentence(["+"], 1, interpreter);
      const expected = new Add([], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '+'", () => {
      expectRuntimeError(
        () => opcodeFromSentence(["+", "+"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );
    });

    it("should return correct opcode object for '-'", () => {
      const res = opcodeFromSentence(["-"], 1, interpreter);
      const expected = new Sub([], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '-'", () => {
      expectRuntimeError(
        () => opcodeFromSentence(["-", "-"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );
    });

    it("should return correct opcode object for '/'", () => {
      const res = opcodeFromSentence(["/"], 1, interpreter);
      const expected = new Div([], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '/'", () => {
      expectRuntimeError(
        () => opcodeFromSentence(["/", "/"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );
    });

    it("should return correct opcode object for '*'", () => {
      const res = opcodeFromSentence(["*"], 1, interpreter);
      const expected = new Mul([], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '*'", () => {
      expectRuntimeError(
        () => opcodeFromSentence(["*", "*"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );
    });

    it("should return correct opcode object for 'addr'", () => {
      const address = "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE";
      const res = opcodeFromSentence(["addr", address], 1, interpreter);
      const expected = new Addr([address], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for 'addr'", () => {
      expectRuntimeError(
        () => opcodeFromSentence(["addr"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );
    });

    it("should throw error for invalid address for 'addr'", () => {
      expectRuntimeError(
        () => opcodeFromSentence(["addr", "AKGH12"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.INVALID_ADDR
      );
    });

    it("should return correct opcode object for 'int'", () => {
      const value = "812546821";
      const res = opcodeFromSentence(["int", value], 1, interpreter);
      const expected = new Int([value], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for 'int'", () => {
      expectRuntimeError(
        () => opcodeFromSentence(["int"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );
    });

    it("should throw error for invalid number for 'int'", () => {
      expectRuntimeError(
        () => opcodeFromSentence(["int", "123A12"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.INVALID_TYPE
      );

      expectRuntimeError(
        () => opcodeFromSentence(["int", String(MAX_UINT64 + 5n)], 1, interpreter),
        RUNTIME_ERRORS.TEAL.UINT64_OVERFLOW
      );

      expectRuntimeError(
        () => opcodeFromSentence(["int", String(MIN_UINT64 - 5n)], 1, interpreter),
        RUNTIME_ERRORS.TEAL.INVALID_TYPE
      );
    });

    it("should return correct label", () => {
      const res = opcodeFromSentence(["label:"], 1, interpreter);
      const expected = new Label(["label:"], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error if wrong label is used", () => {
      expectRuntimeError(
        () => opcodeFromSentence(["substring:"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.INVALID_LABEL
      );
    });

    it("should return correct objects for `txn`", () => {
      let res = opcodeFromSentence(["txn", "Fee"], 1, interpreter);
      let expected = new Txn(["Fee"], 1, interpreter);
      assert.deepEqual(res, expected);

      res = opcodeFromSentence(["txn", "Accounts", "1"], 1, interpreter);
      expected = new Txn(["Accounts", "1"], 1, interpreter);
      assert.deepEqual(res, expected);

      res = opcodeFromSentence(["txn", "ApplicationArgs", "0"], 1, interpreter);
      expected = new Txn(["ApplicationArgs", "0"], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["txn", "Fee", "Fee"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      expectRuntimeError(
        () => opcodeFromSentence(["txn", "fee"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.UNKNOWN_TRANSACTION_FIELD
      );
    });

    it("should return correct object for `gtxn`", () => {
      let res = opcodeFromSentence(["gtxn", "0", "Fee"], 1, interpreter);
      let expected = new Gtxn(["0", "Fee"], 1, interpreter);
      assert.deepEqual(res, expected);

      res = opcodeFromSentence(["gtxn", "0", "ApplicationArgs", "0"], 1, interpreter);
      expected = new Gtxn(["0", "ApplicationArgs", "0"], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["gtxn", "1"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      expectRuntimeError(
        () => opcodeFromSentence(["gtxn", "1AA", "Fee"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.INVALID_TYPE
      );
    });

    it("should return correct object for `txna`", () => {
      let res = opcodeFromSentence(["txna", "Accounts", "0"], 1, interpreter);
      let expected = new Txna(["Accounts", "0"], 1, interpreter);
      assert.deepEqual(res, expected);

      res = opcodeFromSentence(["txna", "ApplicationArgs", "2"], 1, interpreter);
      expected = new Txna(["ApplicationArgs", "2"], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["txna", "Fee", "2"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.INVALID_OP_ARG
      );

      expectRuntimeError(
        () => opcodeFromSentence(["txna", "2"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      expectRuntimeError(
        () => opcodeFromSentence(["txna", "Fee", "A"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.INVALID_TYPE
      );
    });

    it("should return correct object for `gtxna`", () => {
      let res = opcodeFromSentence(["gtxna", "1", "Accounts", "1"], 1, interpreter);
      let expected = new Gtxna(["1", "Accounts", "1"], 1, interpreter);
      assert.deepEqual(res, expected);

      res = opcodeFromSentence(["gtxna", "1", "ApplicationArgs", "4"], 1, interpreter);
      expected = new Gtxna(["1", "ApplicationArgs", "4"], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["gtxna", "1", "Fee", "4"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.INVALID_OP_ARG
      );

      expectRuntimeError(
        () => opcodeFromSentence(["gtxna", "1", "2", "3", "4"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      expectRuntimeError(
        () => opcodeFromSentence(["gtxna", "1AB", "Fee", "4"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.INVALID_TYPE
      );
    });

    it("should return correct objects for `global`", () => {
      let res = opcodeFromSentence(["global", "MinTxnFee"], 1, interpreter);
      let expected = new Global(["MinTxnFee"], 1, interpreter);
      assert.deepEqual(res, expected);

      res = opcodeFromSentence(["global", "MinBalance"], 1, interpreter);
      expected = new Global(["MinBalance"], 1, interpreter);
      assert.deepEqual(res, expected);

      res = opcodeFromSentence(["global", "MaxTxnLife"], 1, interpreter);
      expected = new Global(["MaxTxnLife"], 1, interpreter);
      assert.deepEqual(res, expected);

      res = opcodeFromSentence(["global", "ZeroAddress"], 1, interpreter);
      expected = new Global(["ZeroAddress"], 1, interpreter);
      assert.deepEqual(res, expected);

      res = opcodeFromSentence(["global", "GroupSize"], 1, interpreter);
      expected = new Global(["GroupSize"], 1, interpreter);
      assert.deepEqual(res, expected);

      res = opcodeFromSentence(["global", "LogicSigVersion"], 1, interpreter);
      expected = new Global(["LogicSigVersion"], 1, interpreter);
      assert.deepEqual(res, expected);

      res = opcodeFromSentence(["global", "Round"], 1, interpreter);
      expected = new Global(["Round"], 1, interpreter);
      assert.deepEqual(res, expected);

      res = opcodeFromSentence(["global", "LatestTimestamp"], 1, interpreter);
      expected = new Global(["LatestTimestamp"], 1, interpreter);
      assert.deepEqual(res, expected);

      res = opcodeFromSentence(["global", "CurrentApplicationID"], 1, interpreter);
      expected = new Global(["CurrentApplicationID"], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["global", "MinTxnFee", "MinTxnFee"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      expectRuntimeError(
        () => opcodeFromSentence(["global", "mintxnfee"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
      );

      expectRuntimeError(
        () => opcodeFromSentence(["global", "minbalance"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
      );

      expectRuntimeError(
        () => opcodeFromSentence(["global", "maxtxnlife"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
      );
    });

    it("should return correct opcodes for `Balance` and `Asset` opcodes", () => {
      let res = opcodeFromSentence(["balance"], 1, interpreter);
      let expected = new Balance([], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["balance", "1"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      res = opcodeFromSentence(["asset_holding_get", "AssetBalance"], 1, interpreter);
      expected = new GetAssetHolding(["AssetBalance"], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["asset_holding_get", "AssetBalance", "AssetFrozen"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      res = opcodeFromSentence(["asset_params_get", "AssetTotal"], 1, interpreter);
      expected = new GetAssetDef(["AssetTotal"], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["asset_params_get", "AssetTotal", "123"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );
    });

    it("should return correct opcodes for Stateful opcodes", () => {
      let res = opcodeFromSentence(["app_opted_in"], 1, interpreter);
      let expected = new AppOptedIn([], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["app_opted_in", "12", "123"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      res = opcodeFromSentence(["app_local_get"], 1, interpreter);
      expected = new AppLocalGet([], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["app_local_get", "123"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      res = opcodeFromSentence(["app_local_get_ex"], 1, interpreter);
      expected = new AppLocalGetEx([], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["app_local_get_ex", "22", "123"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      res = opcodeFromSentence(["app_global_get"], 1, interpreter);
      expected = new AppGlobalGet([], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["app_global_get", "12", "3"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      res = opcodeFromSentence(["app_global_get_ex"], 1, interpreter);
      expected = new AppGlobalGetEx([], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["app_global_get_ex", "4"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      res = opcodeFromSentence(["app_local_put"], 1, interpreter);
      expected = new AppLocalPut([], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["app_local_put", "1223"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      res = opcodeFromSentence(["app_global_put"], 1, interpreter);
      expected = new AppGlobalPut([], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["app_global_put", "123"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      res = opcodeFromSentence(["app_local_del"], 1, interpreter);
      expected = new AppLocalDel([], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["app_local_del", "3"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );

      res = opcodeFromSentence(["app_global_del"], 1, interpreter);
      expected = new AppGlobalDel([], 1, interpreter);
      assert.deepEqual(res, expected);

      expectRuntimeError(
        () => opcodeFromSentence(["app_global_del", "45"], 1, interpreter),
        RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
      );
    });
  });

  const cryptoFile = "test-crypto.teal";
  describe("Opcodes list from TEAL file", () => {
    useFixture("teal-files");

    let interpreter: Interpreter;
    beforeEach(function () {
      interpreter = new Interpreter();
      interpreter.tealVersion = 2;
    });

    it("Should return correct opcode list for '+'", async () => {
      const file1 = "test-file-1.teal";
      let res = parser(getProgram(file1), ExecutionMode.STATELESS, interpreter);
      const expected = [new Int(["1"], 1), new Int(["3"], 2), new Add([], 3)];

      assert.deepEqual(res, expected);

      const expect = [new Pragma(["version", "2"], 1, interpreter), new Int(["1"], 2),
        new Int(["3"], 3), new Add([], 4)];
      res = parser(getProgram("test-file-2.teal"), ExecutionMode.STATELESS, interpreter);

      assert.deepEqual(res, expect);
    });

    it("Should throw error if #pragma is not on 1st line", async () => {
      let file = "test-pragma-1.teal";
      expectRuntimeError(
        () => parser(getProgram(file), ExecutionMode.STATELESS, interpreter),
        RUNTIME_ERRORS.TEAL.PRAGMA_NOT_AT_FIRST_LINE
      );

      file = "test-pragma-2.teal";
      expectRuntimeError(
        () => parser(getProgram(file), ExecutionMode.STATELESS, interpreter),
        RUNTIME_ERRORS.TEAL.PRAGMA_NOT_AT_FIRST_LINE
      );
    });

    it("Should return correct opcode list for '-'", async () => {
      const file = "test-file-3.teal";
      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [
        new Pragma(["version", "2"], 1, interpreter),
        new Int(["5"], 2),
        new Int(["3"], 3),
        new Sub([], 4)
      ];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for '/'", async () => {
      const file = "test-file-4.teal";
      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [
        new Pragma(["version", "2"], 1, interpreter),
        new Int(["6"], 2),
        new Int(["3"], 3),
        new Div([], 6)
      ];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for '*'", async () => {
      const file = "test-file-5.teal";
      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [
        new Pragma(["version", "2"], 1, interpreter),
        new Int(["5"], 4),
        new Int(["3"], 6),
        new Mul([], 10)
      ];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'addr'", async () => {
      const file = "test-addr.teal";
      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [
        new Pragma(["version", "2"], 1, interpreter),
        new Addr(["WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE"], 2)
      ];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'byte'", async () => {
      const file = "test-byte.teal";
      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const byte64 = "QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=";
      const byte32 = "MFRGGZDFMY======";

      const expected = [
        new Byte(["b64", byte64], 1), new Byte(["b64", byte64], 2),
        new Byte(["b64", byte64], 3), new Byte(["b64", byte64], 4),
        new Byte(["b32", byte32], 5), new Byte(["b32", byte32], 6),
        new Byte(["b32", byte32], 7), new Byte(["b32", byte32], 8)
      ];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'Len and Err'", async () => {
      const file = "test-len-err.teal";
      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [new Len([], 1), new Err([], 2)];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'Bitwise'", async () => {
      const file = "test-bitwise.teal";
      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [
        new BitwiseOr([], 2),
        new BitwiseAnd([], 4),
        new BitwiseXor([], 6),
        new BitwiseNot([], 7)
      ];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'Mod'", async () => {
      const file = "test-mod.teal";
      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [new Int(["6"], 1), new Int(["3"], 2), new Mod([], 3)];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'Arg'", async () => {
      const file = "test-arg.teal";
      interpreter.runtime = new Runtime([]);
      interpreter.runtime.ctx.args = [new Uint8Array(0)];

      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [new Arg(["0"], 1, interpreter)];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'Intc and Bytec'", async () => {
      const file = "test-int-bytec.teal";
      interpreter.intcblock = [1n];
      interpreter.bytecblock = [new Uint8Array(0)];

      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [new Intc(["0"], 1, interpreter), new Bytec(["0"], 2, interpreter)];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'Store and Load'", async () => {
      const file = "test-store-load.teal";
      interpreter.scratch = [1n];

      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [new Store(["0"], 1, interpreter), new Load(["0"], 2, interpreter)];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'Crypto opcodes'", async () => {
      const res = parser(getProgram(cryptoFile), ExecutionMode.STATELESS, interpreter);
      const expected = [
        new Sha256([], 1),
        new Keccak256([], 2),
        new Sha512_256([], 3),
        new Ed25519verify([], 4)
      ];
      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'comparsions'", async () => {
      const file = "test-compare.teal";

      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [
        new LessThan([], 1),
        new GreaterThan([], 2),
        new LessThanEqualTo([], 3),
        new GreaterThanEqualTo([], 4),
        new And([], 5),
        new Or([], 6),
        new EqualTo([], 7),
        new NotEqualTo([], 8),
        new Not([], 9)
      ];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'all others'", async () => {
      const file = "test-others.teal";

      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [
        new Pragma(["version", "2"], 1, interpreter),
        new Itob([], 2),
        new Btoi([], 3),
        new Mulw([], 4),
        new Addw([], 5),
        new Pop([], 6),
        new Dup([], 7),
        new Dup2([], 8),
        new Concat([], 9),
        new Substring(["0", "4"], 10),
        new Substring3([], 11)
      ];

      assert.deepEqual(res, expected);
    });

    it("should return correct opcode list for 'b, bz, bnz'", async () => {
      const file = "test-branch.teal";

      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [
        new Branch(["label1"], 2, interpreter),
        new BranchIfZero(["label2"], 3, interpreter),
        new BranchIfNotZero(["label3"], 4, interpreter)
      ];

      assert.deepEqual(res, expected);
    });

    it("should return correct opcode list for 'return'", async () => {
      const file = "test-return.teal";

      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [new Return([], 2, interpreter)];

      assert.deepEqual(res, expected);
    });

    it("should return correct opcode list for 'Label'", async () => {
      const file = "test-label.teal";

      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [new Label(["label:"], 2)];

      assert.deepEqual(res, expected);
    });

    it("should return correct opcode list for 'global'", async () => {
      const file = "test-global.teal";

      const res = parser(getProgram(file), ExecutionMode.STATELESS, interpreter);
      const expected = [
        new Global(["MinTxnFee"], 3, interpreter),
        new Global(["MinBalance"], 4, interpreter),
        new Global(["MaxTxnLife"], 5, interpreter),
        new Global(["ZeroAddress"], 6, interpreter),
        new Global(["GroupSize"], 7, interpreter),
        new Global(["LogicSigVersion"], 8, interpreter),
        new Global(["Round"], 9, interpreter),
        new Global(["LatestTimestamp"], 10, interpreter),
        new Global(["CurrentApplicationID"], 11, interpreter)
      ];

      assert.deepEqual(res, expected);
    });

    it("should return correct opcode list for `Stateful`", async () => {
      const file = "test-stateful.teal";

      const res = parser(getProgram(file), ExecutionMode.STATEFUL, interpreter);
      const expected = [
        new Pragma(["version", "2"], 1, interpreter),
        new Balance([], 4, interpreter),
        new GetAssetHolding(["AssetBalance"], 5, interpreter),
        new GetAssetDef(["AssetTotal"], 6, interpreter),
        new AppOptedIn([], 8, interpreter),
        new AppLocalGet([], 9, interpreter),
        new AppLocalGetEx([], 10, interpreter),
        new AppGlobalGet([], 11, interpreter),
        new AppGlobalGetEx([], 12, interpreter),
        new AppLocalPut([], 13, interpreter),
        new AppGlobalPut([], 14, interpreter),
        new AppLocalDel([], 15, interpreter),
        new AppGlobalDel([], 16, interpreter)
      ];

      assert.deepEqual(res, expected);
    });
  });

  describe("Gas cost of Opcodes from TEAL file", () => {
    useFixture("teal-files");

    let interpreter: Interpreter;
    beforeEach(function () {
      interpreter = new Interpreter();
    });

    it("Should return correct gas cost for 'Crypto opcodes' for tealversion 1", async () => {
      interpreter.tealVersion = 1; // by default the version is also 1

      let op = opcodeFromSentence(["sha256"], 1, interpreter);
      assert.equal(interpreter.gas, 7);

      interpreter.gas = 0;
      op = opcodeFromSentence(["keccak256"], 2, interpreter);
      assert.equal(interpreter.gas, 26);

      interpreter.gas = 0;
      op = opcodeFromSentence(["sha512_256"], 3, interpreter);
      assert.equal(interpreter.gas, 9);

      interpreter.gas = 0;
      // eslint-disable-next-line
      op = opcodeFromSentence(["ed25519verify"], 4, interpreter);
      assert.equal(interpreter.gas, 1900);

      interpreter.gas = 0;
      parser(getProgram(cryptoFile), ExecutionMode.STATELESS, interpreter);
      assert.equal(interpreter.gas, 1942); // 7 + 26 + 9 + 1900
    });

    it("Should return correct gas cost for 'Crypto opcodes' for tealversion 2", async () => {
      interpreter.tealVersion = 2;

      let op = opcodeFromSentence(["sha256"], 1, interpreter);
      assert.equal(interpreter.gas, 35);

      interpreter.gas = 0;
      op = opcodeFromSentence(["keccak256"], 2, interpreter);
      assert.equal(interpreter.gas, 130);

      interpreter.gas = 0;
      op = opcodeFromSentence(["sha512_256"], 3, interpreter);
      assert.equal(interpreter.gas, 45);

      interpreter.gas = 0;
      // eslint-disable-next-line
      op = opcodeFromSentence(["ed25519verify"], 4, interpreter);
      assert.equal(interpreter.gas, 1900);

      interpreter.gas = 0;
      parser(getProgram(cryptoFile), ExecutionMode.STATELESS, interpreter);
      assert.equal(interpreter.gas, 2110); // 35 + 130 + 45 + 1900
    });

    it("Should return correct gas cost for mix opcodes from teal files", async () => {
      let file = "test-file-1.teal";
      const mode = ExecutionMode.STATELESS;
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
      assert.equal(interpreter.gas, 10);

      interpreter.gas = 0;
      file = "test-stateful.teal";
      parser(getProgram(file), ExecutionMode.STATEFUL, interpreter);
      assert.equal(interpreter.gas, 12);
    });

    it("Should throw error if total cost exceeds 20000", async () => {
      const file = "test-max-opcost.teal"; // has cost 22800
      expectRuntimeError(
        () => parser(getProgram(file), ExecutionMode.STATELESS, interpreter),
        RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED
      );
    });
  });
});
