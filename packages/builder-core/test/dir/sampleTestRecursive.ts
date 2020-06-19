import { assert } from "chai";
import { greeter } from "../../src/hi";

describe("sample recursive test", () => {
  it("should run chai assertion in dir", async function () {
    assert.equal(greeter("John"), "Hello, John");
  });
});
