import { assert } from "chai";
import path from "path";

import { ERRORS } from "../../../src/errors/errors-list";
import { Interpreter } from "../../../src/interpreter/interpreter";
import {
  Add, Addr, Addw, And, Arg, BitwiseAnd, BitwiseNot, BitwiseOr,
  BitwiseXor, Btoi, Byte, Bytec, Concat, Div, Dup, Dup2, Ed25519verify, EqualTo, Err, GreaterThan,
  GreaterThanEqualTo, Int, Intc, Itob, Keccak256, Len, LessThan, LessThanEqualTo,
  Load, Mod, Mul, Mulw, Not, NotEqualTo, Or, Pop, Pragma, Sha256, Sha512_256, Store, Sub,
  Substring, Substring3
} from "../../../src/interpreter/opcode-list";
import { opcodeFromSentence, parser, wordsFromLine } from "../../../src/interpreter/parser";
import { expectTealError } from "../../helpers/errors";
import { useFixtureProject } from "../../helpers/project";

function getPath (file: string): string {
  return path.join(process.cwd(), file);
}
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

      // Ignore comment
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
  });

  describe("Opcode Objects from words", () => {
    const interpreter = new Interpreter();

    it("should return correct opcode object for '+'", () => {
      const res = opcodeFromSentence(["+"], 1, interpreter);
      const expected = new Add([], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '+'", () => {
      expectTealError(
        () => opcodeFromSentence(["+", "+"], 1, interpreter),
        ERRORS.TEAL.ASSERT_LENGTH
      );
    });

    it("should return correct opcode object for '-'", () => {
      const res = opcodeFromSentence(["-"], 1, interpreter);
      const expected = new Sub([], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '-'", () => {
      expectTealError(
        () => opcodeFromSentence(["-", "-"], 1, interpreter),
        ERRORS.TEAL.ASSERT_LENGTH
      );
    });

    it("should return correct opcode object for '/'", () => {
      const res = opcodeFromSentence(["/"], 1, interpreter);
      const expected = new Div([], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '/'", () => {
      expectTealError(
        () => opcodeFromSentence(["/", "/"], 1, interpreter),
        ERRORS.TEAL.ASSERT_LENGTH
      );
    });

    it("should return correct opcode object for '*'", () => {
      const res = opcodeFromSentence(["*"], 1, interpreter);
      const expected = new Mul([], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '*'", () => {
      expectTealError(
        () => opcodeFromSentence(["*", "*"], 1, interpreter),
        ERRORS.TEAL.ASSERT_LENGTH
      );
    });

    it("should return correct opcode object for 'addr'", () => {
      const address = "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE";
      const res = opcodeFromSentence(["addr", address], 1, interpreter);
      const expected = new Addr([address], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for 'addr'", () => {
      expectTealError(
        () => opcodeFromSentence(["addr"], 1, interpreter),
        ERRORS.TEAL.ASSERT_LENGTH
      );
    });

    it("should throw error for invalid address for 'addr'", () => {
      expectTealError(
        () => opcodeFromSentence(["addr", "AKGH12"], 1, interpreter),
        ERRORS.TEAL.INVALID_ADDR
      );
    });

    it("should return correct opcode object for 'int'", () => {
      const value = "812546821";
      const res = opcodeFromSentence(["int", value], 1, interpreter);
      const expected = new Int([value], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for 'int'", () => {
      expectTealError(
        () => opcodeFromSentence(["int"], 1, interpreter),
        ERRORS.TEAL.ASSERT_LENGTH
      );
    });

    it("should throw error for invalid number for 'int'", () => {
      expectTealError(
        () => opcodeFromSentence(["int", "123A12"], 1, interpreter),
        ERRORS.TEAL.INVALID_TYPE
      );
    });
  });

  describe("Opcodes list from TEAL file", () => {
    useFixtureProject("teal-files");
    const interpreter = new Interpreter();

    it("Sould return correct opcode list for '+'", async () => {
      const file1 = "test-file-1.teal";
      let res = await parser(getPath(file1), interpreter);
      const expected = [new Int(["1"], 1), new Int(["3"], 1), new Add([], 1)];

      assert.deepEqual(res, expected);

      const expect = [new Pragma(["version", "2"], 1), new Int(["1"], 1),
        new Int(["3"], 1), new Add([], 1)];
      res = await parser(path.join(process.cwd(), "test-file-2.teal"), interpreter);
      assert.deepEqual(res, expect);
    });

    it("Sould return correct opcode list for '-'", async () => {
      const file = "test-file-3.teal";
      const res = await parser(getPath(file), interpreter);
      const expected = [
        new Pragma(["version", "2"], 1), new Int(["5"], 1),
        new Int(["3"], 1),
        new Sub([], 1)
      ];

      assert.deepEqual(res, expected);
    });

    it("Sould return correct opcode list for '/'", async () => {
      const file = "test-file-4.teal";
      const res = await parser(getPath(file), interpreter);
      const expected = [
        new Pragma(["version", "2"], 1),
        new Int(["6"], 1),
        new Int(["3"], 1),
        new Div([], 1)
      ];

      assert.deepEqual(res, expected);
    });

    it("Sould return correct opcode list for '*'", async () => {
      const file = "test-file-5.teal";
      const res = await parser(getPath(file), interpreter);
      const expected = [
        new Pragma(["version", "2"], 1),
        new Int(["5"], 1),
        new Int(["3"], 1),
        new Mul([], 1)
      ];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'addr'", async () => {
      const file = "test-addr.teal";
      const res = await parser(getPath(file), interpreter);
      const expected = [
        new Pragma(["version", "2"], 1),
        new Addr(["WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE"], 2)
      ];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'byte'", async () => {
      const file = "test-byte.teal";
      const res = await parser(getPath(file), interpreter);
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
      const res = await parser(getPath(file), interpreter);
      const expected = [new Len([], 1), new Err([], 2)];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'Bitwise'", async () => {
      const file = "test-bitwise.teal";
      const res = await parser(getPath(file), interpreter);
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
      const res = await parser(getPath(file), interpreter);
      const expected = [new Int(["6"], 1), new Int(["3"], 2), new Mod([], 1)];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'Arg'", async () => {
      const file = "test-arg.teal";
      interpreter.args = [new Uint8Array(0)];

      const res = await parser(getPath(file), interpreter);
      const expected = [new Arg(["0"], 1, interpreter)];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'Intc and Bytec'", async () => {
      const file = "test-int-bytec.teal";
      interpreter.intcblock = [BigInt("1")];
      interpreter.bytecblock = [new Uint8Array(0)];

      const res = await parser(getPath(file), interpreter);
      const expected = [new Intc(["0"], 1, interpreter), new Bytec(["0"], 2, interpreter)];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'Store and Load'", async () => {
      const file = "test-store-load.teal";
      interpreter.scratch = [BigInt("1")];

      const res = await parser(getPath(file), interpreter);
      const expected = [new Store(["0"], 1, interpreter), new Load(["0"], 2, interpreter)];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'Crypto opcodes'", async () => {
      const file = "test-crypto.teal";

      const res = await parser(getPath(file), interpreter);
      const expected = [
        new Sha256([], 1),
        new Keccak256([], 2),
        new Sha512_256([], 3),
        new Ed25519verify([], 1)
      ];

      assert.deepEqual(res, expected);
    });

    it("Should return correct opcode list for 'comparsions'", async () => {
      const file = "test-compare.teal";

      const res = await parser(getPath(file), interpreter);
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

      const res = await parser(getPath(file), interpreter);
      const expected = [
        new Itob([], 1),
        new Btoi([], 2),
        new Mulw([], 3),
        new Addw([], 4),
        new Pop([], 5),
        new Dup([], 6),
        new Dup2([], 7),
        new Concat([], 8),
        new Substring(["0", "4"], 9),
        new Substring3([], 10)
      ];

      assert.deepEqual(res, expected);
    });
  });
});
