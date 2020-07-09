
if (runtimeArgs.network !== "custom") {
  const fs = require('fs')
  fs.appendFileSync("output.txt", "failing scripts: script 3 executed\n");
}
