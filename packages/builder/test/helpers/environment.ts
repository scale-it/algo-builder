import { resetBuilderContext } from "../../src/internal/reset";
import { AlgobRuntimeEnv, PromiseAny } from "../../src/types";

declare module "mocha" {
  interface Context {
    env: AlgobRuntimeEnv;
  }
}

export function useEnvironment(beforeEachFn?: (algobRuntimeEnv: AlgobRuntimeEnv) => PromiseAny) {
  beforeEach("Load environment", async function () {
    this.env = require("../../src/internal/lib/lib");
    if (beforeEachFn) {
      return beforeEachFn(this.env)
    }
  });

  afterEach("reset builder context", function () {
    resetBuilderContext();
  });
}
