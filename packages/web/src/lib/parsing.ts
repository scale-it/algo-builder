import { decodeAddress, encodeUint64 } from "algosdk";

import { MAX_UINT64, MIN_UINT64, reDigit } from "./constants";

// verify n is an unsigned 64 bit integer
function assertUint64(n: bigint): void {
	if (n < MIN_UINT64 || n > MAX_UINT64) {
		throw new Error(`Invalid uint64 ${n}`);
	}
}

// parse string to Uint8Array
export function stringToBytes(s: string): Uint8Array {
	return new Uint8Array(Buffer.from(s));
}

/**
 * Converts 64 bit unsigned integer to bytes in big endian.
 */
export function uint64ToBigEndian(x: number | bigint): Uint8Array {
	assertUint64(BigInt(x));
	return encodeUint64(x);
}

/**
 * Takes an Algorand address in string form and decodes it into a Uint8Array (as public key)
 * @param addr : algorand address
 */
export function addressToPk(addr: string): Uint8Array {
	return decodeAddress(addr).publicKey;
}

const throwFmtError = (appArg: string): void => {
	throw new Error(`Format of arguments passed to stateful smart is invalid for ${appArg}`);
};

/**
 * Parses appArgs to bytes if arguments passed to App are similar to goal ('int:1', 'str:hello'..)
 * https://developer.algorand.org/docs/features/asc1/stateful/#passing-arguments-to-stateful-smart-contracts
 * eg. "int:1" => new Uint8Aarray([0, 0, 0, 0, 0, 0, 0, 1])
 * NOTE: parseAppArgs returns undefined to handle the case when application args passed to
 * stateful smart contract is undefined
 * @param appArgs : arguments to stateful smart contract
 */
export function parseAppArgs(appArgs?: Array<Uint8Array | string>): Uint8Array[] | undefined {
	if (appArgs === undefined) {
		return undefined;
	}
	const args = [];

	for (const appArg of appArgs) {
		// if appArg already bytes, then we don't need to parse
		// just push to array and continue
		if (appArg instanceof Uint8Array) {
			args.push(new Uint8Array(appArg)); //in case its a Buffer object
			continue;
		}

		// eg "int:1" => ['int', '1']
		const i = appArg.indexOf(":");
		const [type, value] = [appArg.slice(0, i), appArg.slice(i + 1)];

		// if given string is not invalid, throw error
		if (type === undefined || value === undefined) {
			throwFmtError(appArg);
		}

		// parse string to bytes according to type
		let arg;
		switch (type) {
			case "int": {
				if (!reDigit.test(value)) {
					throwFmtError(appArg);
				} // verify only digits are present in string
				arg = uint64ToBigEndian(BigInt(value));
				break;
			}
			case "str": {
				arg = stringToBytes(value);
				break;
			}
			case "addr": {
				arg = addressToPk(value);
				break;
			}
			case "b64": {
				arg = new Uint8Array(Buffer.from(value, "base64"));
				break;
			}
			default: {
				throwFmtError(appArg);
			}
		}
		args.push(arg);
	}
	return args as Uint8Array[];
}
