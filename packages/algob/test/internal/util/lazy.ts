import { ERRORS } from "@algo-builder/web";
import { assert } from "chai";

import { lazyFunction, lazyObject } from "../../../src/internal/util/lazy";
import { expectBuilderError } from "../../helpers/errors";

// tslint:disable no-inferred-empty-object-type

describe("lazy module", function () {
	describe("lazyObject", function () {
		it("shouldn't call the initializer function eagerly", function () {
			let called = false;
			lazyObject(function () {
				called = true;
				return {};
			});

			assert.isFalse(called);
		});

		it("should throw if the objectConstructor doesn't return an object", function () {
			const num = lazyObject(() => 123 as any);
			assert.throws(() => num.asd);
		});

		it("should call the initializer just once", function () {
			let numberOfCalls = 0;

			const obj = lazyObject(function () {
				numberOfCalls += 1;
				return {
					a: 1 as number | undefined,
					b() {
						return this.a;
					},
				};
			});

			assert.equal(numberOfCalls, 0);

			obj.a = 2;

			assert.equal(numberOfCalls, 1);

			obj.b();

			assert.equal(numberOfCalls, 1);

			delete obj.a;

			assert.equal(numberOfCalls, 1);

			(obj as any).asd = 123;

			assert.equal(numberOfCalls, 1);
		});

		it("should be equivalent to the object returned by the initializer", function () {
			const expected = {
				a: 123,
				b: "asd",
				c: {
					d: [1, 2, 3],
					e: 1.3,
				},
				f: [3, { g: 1 }],
			};

			const obj = lazyObject(() => ({ ...expected }));

			assert.deepEqual(obj, expected);
		});

		it("doesn't support classes", function () {
			const obj = lazyObject(() => class { }) as any; // eslint-disable-line @typescript-eslint/no-extraneous-class

			expectBuilderError(() => (obj.asd = 123), ERRORS.GENERAL.UNSUPPORTED_OPERATION);
			expectBuilderError(() => obj.asd, ERRORS.GENERAL.UNSUPPORTED_OPERATION);
			assert.throws(() => new obj(), "obj is not a constructor"); // eslint-disable-line new-cap
		});

		it("doesn't support functions", function () {
			const obj = lazyObject(() => function () { }) as any; // eslint-disable-line @typescript-eslint/no-empty-function

			expectBuilderError(() => (obj.asd = 123), ERRORS.GENERAL.UNSUPPORTED_OPERATION);
			expectBuilderError(() => obj.asd, ERRORS.GENERAL.UNSUPPORTED_OPERATION);

			assert.throws(() => obj(), "obj is not a function");
		});

		it("should trap defineProperty correctly", function () {
			const obj = lazyObject(() => ({})) as any;
			obj.asd = 123;

			assert.equal(obj.asd, 123);
		});

		it("should trap deleteProperty correctly", function () {
			const obj = lazyObject(() => ({ a: 1 as number | undefined }));
			delete obj.a;

			assert.isUndefined(obj.a);
		});

		it("should trap get correctly", function () {
			const obj = lazyObject(() => ({ a: 1 }));
			assert.equal(obj.a, 1);
		});

		it("should trap getOwnPropertyDescriptor correctly", function () {
			const obj = lazyObject(() => ({ a: 1 }));

			assert.deepEqual(Object.getOwnPropertyDescriptor(obj, "a"), {
				value: 1,
				writable: true,
				enumerable: true,
				configurable: true,
			});
		});

		it("should trap getPrototypeOf correctly", function () {
			const proto = {};
			const obj = lazyObject(() => Object.create(proto));

			assert.equal(Object.getPrototypeOf(obj), proto);
		});

		it("should trap isExtensible correctly", function () {
			const obj = lazyObject(function () {
				const v = {};
				Object.preventExtensions(v);

				return v;
			});

			assert.isFalse(Object.isExtensible(obj));

			const obj2 = lazyObject(() => ({}));
			assert.isTrue(Object.isExtensible(obj2));
		});

		describe("Lazy object with a property", function () {
			const proto = { a: 1 };
			const obj = lazyObject(function () {
				const v = Object.create(proto);
				v.b = 1;

				return v;
			});

			it("should trap has correctly", function () {
				assert.isTrue("a" in obj);
				assert.isTrue("b" in obj);
				assert.isFalse("c" in obj);
			});

			it("should trap ownKeys correctly", function () {
				obj.c = 123;

				assert.deepEqual(Object.getOwnPropertyNames(obj), ["b", "c"]);
			});
		});

		it("should trap preventExtensions correctly", function () {
			const obj = lazyObject(() => ({}));
			Object.preventExtensions(obj);

			assert.isFalse(Object.isExtensible(obj));
		});

		it("should trap set correctly", function () {
			const obj = lazyObject(() => ({})) as any;
			obj.asd = 123;

			assert.deepEqual(Object.getOwnPropertyNames(obj), ["asd"]);
			assert.equal(obj.asd, 123);
		});

		it("should trap setPrototypeOf correctly", function () {
			const proto = Object.create(null);
			const obj = lazyObject(() => Object.create(proto));
			assert.equal(Object.getPrototypeOf(obj), proto);
			assert.isUndefined(obj.a);

			const newProto = { a: 123 };
			Object.setPrototypeOf(obj, newProto);
			assert.equal(Object.getPrototypeOf(obj), newProto);
			assert.equal(obj.a, 123);
		});

		it("should throw if it's used to create an object without prototype", function () {
			const obj = lazyObject(() => Object.create(null));
			expectBuilderError(() => obj.asd, ERRORS.GENERAL.UNSUPPORTED_OPERATION);
		});
	});
});

describe("lazy import", function () {
	it("should work with a function module", function () {
		const lazyF = lazyFunction(() => () => ({ a: 1, b: 2 }));
		assert.deepEqual(lazyF(), { a: 1, b: 2 });
	});

	it("should work with a class module", function () {
		const lazyC = lazyFunction(
			() =>
				class {
					public a: number;
					public b: number;
					constructor() {
						this.a = 1;
						this.b = 2;
					}
				}
		);

		assert.deepEqual(new lazyC(), { a: 1, b: 2 }); // eslint-disable-line new-cap
	});
});
