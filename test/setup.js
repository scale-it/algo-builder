/* This files setups mocha tests: it stubs and suppress all console logs.
   In tests, it's possible to verify that a console.[x] was called and with what arguments,
   Eample:  `assert.true(console.error.calledWith('some string value'))`

   To use this setup module, you have to define `--file` argument for mocha. Best
   way to do it is to use `file` configuration parameter in `package.json` `mocha` section or
   in `.mocharc.json`. All algob packages has this configuration set.
 */

import sinon from 'sinon';

const levels = ['log', 'debug', 'info', 'warn', 'error'];

before(() => {
  for (let l of levels)
    if (!console[l].restore)
      sinon.stub(console, l);
})

beforeEach(() => {
  for (let l of levels)
    console[l].reset();
})


after(() => {
  for (let l of levels)
    console[l].restore();
})
