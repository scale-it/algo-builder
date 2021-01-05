import { assert } from "chai";
import fsExtra from "fs-extra";
import path from "path";

import {
  getPackageJson,
  getPackageRoot
} from "../../../src/internal/util/package-info";

describe("package-info", () => {
  it("Should give the right package.json", async () => {
    const packageJson = await getPackageJson();
    assert.equal(packageJson.name, "@algorand-builder/algob");
    // We don't test the version number because that would be hard to maintain
    assert.isString(packageJson.version);
  });

  it("should give the right package root", async () => {
    const root = await fsExtra.realpath(path.join(__dirname, "..", "..", ".."));
    assert.equal(await getPackageRoot(), root);
  });
});
