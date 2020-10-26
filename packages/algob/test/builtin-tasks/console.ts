import { TASK_CONSOLE } from "../../src/builtin-tasks/task-names";
import { useEnvironment } from "../helpers/environment";

describe("Compile task", function () {
  useEnvironment();
  it("Should open repl session", async function () {
    await this.env.run(TASK_CONSOLE, {
      noCompile: true
    });
  });
});
