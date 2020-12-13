const fs = require('fs')
fs.appendFileSync('output.txt', 'failing load script executed\n')

throw new Error('This error is intended')
