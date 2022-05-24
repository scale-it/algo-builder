// compute square root of bigint
// ref https://stackoverflow.com/questions/53683995/javascript-big-integer-square-root
export const bigintSqrt = (value: bigint): bigint => {
	if (value < 2n) {
		return value;
	}

	if (value < 16n) {
		return BigInt(Math.floor(Math.sqrt(Number(value))));
	}

	let x1;
	if (value < 1n << 52n) {
		x1 = BigInt(Math.floor(Math.sqrt(Number(value)))) - 3n;
	} else {
		x1 = (1n << 52n) - 2n;
	}

	let x0 = -1n;
	while (x0 !== x1 && x0 !== x1 - 1n) {
		x0 = x1;
		x1 = (value / x0 + x0) >> 1n;
	}
	return x0;
};
