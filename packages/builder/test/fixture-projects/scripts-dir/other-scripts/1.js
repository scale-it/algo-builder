
if (runtimeArgs.network !== "custom") {
  const fs = require('fs')
  fs.appendFileSync("output.txt", "other scripts directory: script 1 executed\n");
}
