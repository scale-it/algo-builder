import { resetBuilderContext } from "../../src/internal/reset";
import { AlgobRuntimeEnv } from "../../src/types";

declare module "mocha" {
  interface Context {
    env: AlgobRuntimeEnv;
  }
}

export function useEnvironment() {
  beforeEach("Load environment", function () {
    this.env = require("../../src/internal/lib/lib");
  });

  afterEach("reset builder context", function () {
    resetBuilderContext();
  });
}
