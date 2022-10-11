import { assert } from "chai";

import * as nested from "../../fixture-projects/nested-node-project/project/nested-caller-package-tester";
import * as top from "../../fixture-projects/nested-node-project/top-caller-package-tester";

describe("getClosestCallerPackage", function () {
	top.callFromNestedModule();
	top.callFromTopModule();
	top.indirectlyCallFromTopModule();

	describe("When calling directly from a package", function () {
		it("Should return the package it was called from", function () {
			assert.equal(top.callFromTopModule(), "top-level-node-project");
			assert.equal(nested.callFromNestedModule(), "nested-node-project");
		});
	});

	describe("When calling indirectly", function () {
		it("Should return the closest package from where it was called", function () {
			assert.equal(top.callFromNestedModule(), "nested-node-project");
			assert.equal(top.indirectlyCallFromTopModule(), "top-level-node-project");

			assert.equal(nested.callFromTopModule(), "top-level-node-project");
			assert.equal(nested.indirectlyCallFromNestedpModule(), "nested-node-project");
		});
	});
});
