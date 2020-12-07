import { assert } from "chai";

import { ERRORS } from "../../../src/errors/errors-list";
import { fieldsFromLine } from "../../../src/interpreter/parser";

// base64 case needs to be verified at the time of decoding
describe("Parser", function () {
  it("should ", function () {
    const res = fieldsFromLine("addr KAGKGFFKGKGFGLFFBSLFBJKSFB//END HERE");
    console.log(res);
    const res1 = fieldsFromLine("byte base64 BKBDKSKDK //coommetn here");
    assert.equal(res1, ["JJ"]);
  });
});
