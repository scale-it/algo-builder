setTimeout(() => {
  if (runtimeArgs.network !== "custom") {
    const fs = require('fs')
    fs.appendFileSync("output.txt", "scripts directory: script 2 executed\n");
  }
}, 100);
