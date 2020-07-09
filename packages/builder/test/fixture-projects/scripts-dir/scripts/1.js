
if (runtimeArgs.network !== "custom") {
  const fs = require('fs')
  fs.appendFileSync("output.txt", "scripts directory: script 1 executed\n");
}

