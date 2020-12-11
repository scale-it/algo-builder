import { assert } from "chai";
import path from "path";

import { ERRORS } from "../../../src/errors/errors-list";
import { Add, Addr, Div, Int, Mul, Pragma, Sub } from "../../../src/interpreter/opcode-list";
import { opcodeFromSentence, parser, wordsFromLine } from "../../../src/interpreter/parser";
import { expectTealError } from "../../helpers/errors";
import { useFixtureProject } from "../../helpers/project";

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
    it("should return correct opcode object for '+'", () => {
      const res = opcodeFromSentence(["+"], 1);
      const expected = new Add([], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '+'", () => {
      expectTealError(
        () => opcodeFromSentence(["+", "+"], 1),
        ERRORS.TEAL.ASSERT_FIELD_LENGTH
      );
    });

    it("should return correct opcode object for '-'", () => {
      const res = opcodeFromSentence(["-"], 1);
      const expected = new Sub([], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '-'", () => {
      expectTealError(
        () => opcodeFromSentence(["-", "-"], 1),
        ERRORS.TEAL.ASSERT_FIELD_LENGTH
      );
    });

    it("should return correct opcode object for '/'", () => {
      const res = opcodeFromSentence(["/"], 1);
      const expected = new Div([], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '/'", () => {
      expectTealError(
        () => opcodeFromSentence(["/", "/"], 1),
        ERRORS.TEAL.ASSERT_FIELD_LENGTH
      );
    });

    it("should return correct opcode object for '*'", () => {
      const res = opcodeFromSentence(["*"], 1);
      const expected = new Mul([], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '*'", () => {
      expectTealError(
        () => opcodeFromSentence(["*", "*"], 1),
        ERRORS.TEAL.ASSERT_FIELD_LENGTH
      );
    });

    it("should return correct opcode object for 'addr'", () => {
      const address = "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE";
      const res = opcodeFromSentence(["addr", address], 1);
      const expected = new Addr([address], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for 'addr'", () => {
      expectTealError(
        () => opcodeFromSentence(["addr"], 1),
        ERRORS.TEAL.ASSERT_FIELD_LENGTH
      );
    });

    it("should throw error for invalid address for 'addr'", () => {
      expectTealError(
        () => opcodeFromSentence(["addr", "AKGH12"], 1),
        ERRORS.TEAL.INVALID_ADDR
      );
    });

    it("should return correct opcode object for 'int'", () => {
      const value = "812546821";
      const res = opcodeFromSentence(["int", value], 1);
      const expected = new Int([value], 1);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for 'int'", () => {
      expectTealError(
        () => opcodeFromSentence(["int"], 1),
        ERRORS.TEAL.ASSERT_FIELD_LENGTH
      );
    });

    it("should throw error for invalid number for 'int'", () => {
      expectTealError(
        () => opcodeFromSentence(["int", "123A12"], 1),
        ERRORS.TEAL.INVALID_TYPE
      );
    });
  });

  describe("Opcodes list from TEAL file", () => {
    useFixtureProject("teal-files");

    it("Sould return correct opcode list for '+'", async () => {
      const file1 = "test-file-1.teal";
      const fPath = path.join(process.cwd(), file1);
      let res = await parser(fPath);
      const expected = [new Int(["1"], 1), new Int(["3"], 1), new Add([], 1)];

      assert.deepEqual(res, expected);

      const expect = [new Pragma(["version", "2"], 1), new Int(["1"], 1),
        new Int(["3"], 1), new Add([], 1)];
      res = await parser(path.join(process.cwd(), "test-file-2.teal"));
      assert.deepEqual(res, expect);
    });

    it("Sould return correct opcode list for '-'", async () => {
      const file = "test-file-3.teal";
      const fPath = path.join(process.cwd(), file);
      const res = await parser(fPath);
      const expected = [new Pragma(["version", "2"], 1), new Int(["5"], 1),
        new Int(["3"], 1), new Sub([], 1)];

      assert.deepEqual(res, expected);
    });

    it("Sould return correct opcode list for '/'", async () => {
      const file = "test-file-4.teal";
      const fPath = path.join(process.cwd(), file);
      const res = await parser(fPath);
      const expected = [new Pragma(["version", "2"], 1), new Int(["6"], 1),
        new Int(["3"], 1), new Div([], 1)];

      assert.deepEqual(res, expected);
    });

    it("Sould return correct opcode list for '*'", async () => {
      const file = "test-file-5.teal";
      const fPath = path.join(process.cwd(), file);
      const res = await parser(fPath);
      const expected = [new Pragma(["version", "2"], 1), new Int(["5"], 1),
        new Int(["3"], 1), new Mul([], 1)];

      assert.deepEqual(res, expected);
    });
  });
});
