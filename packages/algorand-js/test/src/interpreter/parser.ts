import { assert } from "chai";

import { ERRORS } from "../../../src/errors/errors-list";
import { Add, Addr, Div, Int, Mul, Sub } from "../../../src/interpreter/opcode-list";
import { fieldsFromLine, opcodeFromFields } from "../../../src/interpreter/parser";
import { expectTealError } from "../../helpers/errors";

// base64 case needs to be verified at the time of decoding
describe("Parser", function () {
  describe("Extract Fields from line", () => {
    it("should return correct fields for addr", function () {
      let res = fieldsFromLine("addr KAGKGFFKGKGFGLFFBSLFBJKSFB");
      const expected = ["addr", "KAGKGFFKGKGFGLFFBSLFBJKSFB"];

      assert.deepEqual(res, expected);

      res = fieldsFromLine("addr KAGKGFFKGKGFGLFFBSLFBJKSFB//comment here");
      assert.deepEqual(res, expected);

      res = fieldsFromLine("addr KAGKGFFKGKGFGLFFBSLFBJKSFB       //comment here");
      assert.deepEqual(res, expected);

      res = fieldsFromLine("addr              KAGKGFFKGKGFGLFFBSLFBJKSFB//comment here");
      assert.deepEqual(res, expected);

      res = fieldsFromLine("      addr     KAGKGFFKGKGFGLFFBSLFBJKSFB//comment here       ");
      assert.deepEqual(res, expected);
    });

    it("should return correct fields for byte base64", () => {
      let res = fieldsFromLine("byte base64 BKBDKSKDK");
      let expected = ["byte", "base64", "BKBDKSKDK"];

      assert.deepEqual(res, expected);

      res = fieldsFromLine("byte base64(BKBDKSKDK)");
      expected = ["byte", "base64(BKBDKSKDK)"];

      assert.deepEqual(res, expected);

      res = fieldsFromLine("byte base64(BKBDKSKD/K)");
      expected = ["byte", "base64(BKBDKSKD/K)"];

      assert.deepEqual(res, expected);

      res = fieldsFromLine("byte base64(BKBDKSKDK//KBBJSKJB)");
      expected = ["byte", "base64(BKBDKSKDK//KBBJSKJB)"];

      assert.deepEqual(res, expected);

      // Ignore comment
      res = fieldsFromLine("byte base64(BKBDKSKDK//KBBJSKJB) // comment here");
      expected = ["byte", "base64(BKBDKSKDK//KBBJSKJB)"];

      assert.deepEqual(res, expected);
    });

    it("should return correct fields for byte base32", () => {
      let res = fieldsFromLine("byte     base32       BKBDKSKDK//commenthere");
      let expected = ["byte", "base32", "BKBDKSKDK"];

      assert.deepEqual(res, expected);

      res = fieldsFromLine("      byte  base32(BKBDKSKDK) //comment");
      expected = ["byte", "base32(BKBDKSKDK)"];

      assert.deepEqual(res, expected);

      res = fieldsFromLine("byte b32(BKBDKSKDK)");
      expected = ["byte", "b32(BKBDKSKDK)"];

      assert.deepEqual(res, expected);

      res = fieldsFromLine("byte b32 BKBDKSKDK//comment");
      expected = ["byte", "b32", "BKBDKSKDK"];

      assert.deepEqual(res, expected);
    });

    it("should return correct fields for byte string literal", () => {
      let res = fieldsFromLine('byte "STRING LITERAL"');
      let expected = ["byte", "\"STRING LITERAL\""];

      assert.deepEqual(res, expected);

      res = fieldsFromLine('byte "STRING \\"NESTED STRING\\" END"');
      expected = ["byte", "\"STRING \\\"NESTED STRING\\\" END\""];

      assert.deepEqual(res, expected);
    });

    it("should return correct fields for int", () => {
      let res = fieldsFromLine("int 123");
      const expected = ["int", "123"];

      assert.deepEqual(res, expected);

      res = fieldsFromLine("int 123//comment here");
      assert.deepEqual(res, expected);

      res = fieldsFromLine("       int       123       //comment here");
      assert.deepEqual(res, expected);

      res = fieldsFromLine("int 123 //comment here");
      assert.deepEqual(res, expected);
    });

    it("should return correct fields for operators", () => {
      let res = fieldsFromLine("+");
      let expected = ["+"];

      assert.deepEqual(res, expected);

      res = fieldsFromLine("  +//comment here");
      assert.deepEqual(res, expected);

      res = fieldsFromLine("+ //comment here");
      assert.deepEqual(res, expected);

      res = fieldsFromLine("         - //comment            here");
      expected = ["-"];
      assert.deepEqual(res, expected);

      res = fieldsFromLine("- //comment here");
      assert.deepEqual(res, expected);

      res = fieldsFromLine("/ //comment here");
      expected = ["/"];
      assert.deepEqual(res, expected);

      res = fieldsFromLine("* //comment here");
      expected = ["*"];
      assert.deepEqual(res, expected);

      res = fieldsFromLine("      *       //    comment     here");
      assert.deepEqual(res, expected);
    });
  });

  describe("Opcode Objects from Fields", () => {
    it("should return correct opcode object for '+'", () => {
      const res = opcodeFromFields(["+"]);
      const expected = new Add();

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '+'", () => {
      expectTealError(
        () => opcodeFromFields(["+", "+"]),
        ERRORS.TEAL.ASSERT_FIELD_LENGTH
      );
    });

    it("should return correct opcode object for '-'", () => {
      const res = opcodeFromFields(["-"]);
      const expected = new Sub();

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '-'", () => {
      expectTealError(
        () => opcodeFromFields(["-", "-"]),
        ERRORS.TEAL.ASSERT_FIELD_LENGTH
      );
    });

    it("should return correct opcode object for '/'", () => {
      const res = opcodeFromFields(["/"]);
      const expected = new Div();

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '/'", () => {
      expectTealError(
        () => opcodeFromFields(["/", "/"]),
        ERRORS.TEAL.ASSERT_FIELD_LENGTH
      );
    });

    it("should return correct opcode object for '*'", () => {
      const res = opcodeFromFields(["*"]);
      const expected = new Mul();

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for '*'", () => {
      expectTealError(
        () => opcodeFromFields(["*", "*"]),
        ERRORS.TEAL.ASSERT_FIELD_LENGTH
      );
    });

    it("should return correct opcode object for 'addr'", () => {
      const address = "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE";
      const res = opcodeFromFields(["addr", address]);
      const expected = new Addr(address);

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for 'addr'", () => {
      expectTealError(
        () => opcodeFromFields(["addr"]),
        ERRORS.TEAL.ASSERT_FIELD_LENGTH
      );
    });

    it("should throw error for invalid address for 'addr'", () => {
      expectTealError(
        () => opcodeFromFields(["addr", "AKGH12"]),
        ERRORS.TEAL.INVALID_ADDR
      );
    });

    it("should return correct opcode object for 'int'", () => {
      const value = "812546821";
      const res = opcodeFromFields(["int", value]);
      const expected = new Int(BigInt(value));

      assert.deepEqual(res, expected);
    });

    it("should throw error for wrong field length for 'int'", () => {
      expectTealError(
        () => opcodeFromFields(["int"]),
        ERRORS.TEAL.ASSERT_FIELD_LENGTH
      );
    });

    it("should throw error for invalid number for 'int'", () => {
      expectTealError(
        () => opcodeFromFields(["int", "123A12"]),
        ERRORS.TEAL.INVALID_TYPE
      );
    });
  });
});
