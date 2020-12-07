import { assert } from "chai";

import { ERRORS } from "../../../src/errors/errors-list";
import { fieldsFromLine } from "../../../src/interpreter/parser";

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
});
