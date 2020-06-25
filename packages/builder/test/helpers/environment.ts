import { resetBuilderContext } from "../../src/internal/reset";
import { BuilderRuntimeEnvironment } from "../../src/types";

declare module "mocha" {
  interface Context {
    env: BuilderRuntimeEnvironment;
  }
}

export function useEnvironment() {
  beforeEach("Load environment", function () {
    this.env = require("../../src/internal/lib/builder-lib");
  });

  afterEach("reset builder context", function () {
    resetBuilderContext();
  });
}
