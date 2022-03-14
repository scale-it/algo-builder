/* This files setups mocha tests: it stubs and suppress all console logs.
	 In tests, it's possible to verify that a console.[x] was called and with what arguments,
	 Example:  `assert.true(console.error.calledWith('some string value'))`

	 To use this setup module, you have to define `--file` argument for mocha. Best
	 way to do it is to use `file` configuration parameter in `package.json` `mocha` section or
	 in `.mocharc.json`. All algob packages has this configuration set.

	 If you want to use console.log to debug your tests then call
	 `(console.log as any).restore();` in your test.
 */

import sinon from "sinon";

const levels = ["log", "debug", "info", "warn", "error"];

before(() => {
	for (let l of levels) if (!console[l].restore) sinon.stub(console, l);
});

beforeEach(() => {
	// if in a test we restored the stub, then we can't reset - instead create a stub again
	for (let l of levels)
		if (console[l].reset !== undefined) console[l].reset();
		else sinon.stub(console, l);
});

after(() => {
	for (let l of levels) if (console[l].restore !== undefined) console[l].restore();
});
