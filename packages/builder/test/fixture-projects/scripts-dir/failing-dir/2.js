const fs = require('fs')
fs.appendFileSync("output.txt", "failing scripts: script 2 failed\n");
process.exit(123);
