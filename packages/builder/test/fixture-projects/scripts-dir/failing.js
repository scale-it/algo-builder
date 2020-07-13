const fs = require('fs')
fs.appendFileSync("output.txt", "failing scripts: script failed\n");
process.exit(123);
