import { parsing } from "@algo-builder/web";
import {
	decodeAddress,
	encodeAddress,
	EncodedLogicSig,
	EncodedLogicSigAccount,
	EncodedMultisig,
	multisigAddress,
	MultisigMetadata,
	signBytes,
	verifyBytes,
} from "algosdk";
import * as murmurhash from "murmurhash";
import * as tweet from "tweetnacl-ts";

import { RUNTIME_ERRORS } from "./errors/errors-list";
import { RuntimeError } from "./errors/runtime-errors";
import { compareArray } from "./lib/compare";
import { convertToString } from "./lib/parsing";

/**
 * Note: We cannot use algosdk LogicSig class here,
 * because algosdk.makeLogicSig() takes compiled bytes as a argument
 * and currently we don't calculate compiled bytes from TEAL program.
 * We are using raw TEAL code as program.(by converting string into bytes)
 */
export class LogicSig {
	logic: Uint8Array;
	args: Uint8Array[];
	sig?: Uint8Array;
	msig?: EncodedMultisig;
	lsigAddress: string;
	tag: Buffer;

	constructor(program: string, programArgs?: Array<Uint8Array | Buffer> | null) {
		this.tag = Buffer.from("Program");
		this.logic = parsing.stringToBytes(program);

		const seedBytes = parsing.uint64ToBigEndian(murmurhash.v3(program));
		const extendedSeed = new Uint8Array(Number(seedBytes.length) + Number(24));
		extendedSeed.set(seedBytes);
		const pair = tweet.sign_keyPair_fromSeed(extendedSeed);
		this.lsigAddress = encodeAddress(pair.publicKey);

		this.tag = Buffer.from("Program");
		if (
			programArgs &&
			(!Array.isArray(programArgs) ||
				!programArgs.every((arg) => arg.constructor === Uint8Array || Buffer.isBuffer(arg)))
		) {
			throw new TypeError("Invalid arguments");
		}

		let args: Uint8Array[];
		if (programArgs != null) {
			args = programArgs.map((arg) => new Uint8Array(arg));
		} else args = [];

		this.args = args;
	}

	/**
	 * Creates signature (if no msig provided) or multi signature otherwise
	 * @param secretKey sender's secret key
	 * @param msig multisignature if it exists
	 */
	sign(secretKey: Uint8Array, msig?: MultisigMetadata): void {
		if (msig === undefined) {
			this.sig = this.signProgram(secretKey);
		} else {
			const subsigs = msig.addrs.map((addr) => {
				return {
					pk: decodeAddress(addr).publicKey,
					s: new Uint8Array(0),
				};
			});
			this.msig = {
				v: msig.version,
				thr: msig.threshold,
				subsig: subsigs,
			};

			const [sig, index] = this.singleSignMultisig(secretKey, this.msig);
			this.msig.subsig[index].s = sig;
		}
	}

	/**
	 * Sign Multisignature
	 * @param secretKey Secret key to sign with
	 * @param msig Multisignature
	 */
	singleSignMultisig(secretKey: Uint8Array, msig: EncodedMultisig): [Uint8Array, number] {
		let index = -1;
		const accountPk = tweet.sign_keyPair_fromSecretKey(secretKey).publicKey;
		for (let i = 0; i < msig.subsig.length; i++) {
			const pk = msig.subsig[i].pk;
			if (compareArray(pk, accountPk)) {
				index = i;
				break;
			}
		}
		if (index === -1) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_SECRET_KEY, {
				secretkey: secretKey,
			});
		}
		const sig = this.signProgram(secretKey);
		return [sig, index];
	}

	/**
	 * Appends a signature to multi signature
	 * @param {Uint8Array} secretKey Secret key to sign with
	 */
	appendToMultisig(secretKey: Uint8Array): void {
		if (this.msig === undefined) {
			throw new Error("no multisig present");
		}
		const [sig, index] = this.singleSignMultisig(secretKey, this.msig);
		this.msig.subsig[index].s = sig;
	}

	/**
	 * Performs signature verification
	 * @param accPk Sender's account pk
	 */
	verify(accPk: Uint8Array): boolean {
		const accAddr = encodeAddress(accPk);
		if (!this.sig && !this.msig) {
			return accAddr === this.lsigAddress;
		}

		if (this.sig) {
			return verifyBytes(this.logic, this.sig, accAddr);
		}

		if (this.msig) {
			return this.verifyMultisig(this.msig, accAddr);
		}

		return false;
	}

	/**
	 * Verify multi-signature
	 * @param msig Msig
	 * @param accAddr Sender's account address
	 */
	verifyMultisig(msig: EncodedMultisig, accAddr: string): boolean {
		const version = msig.v;
		const threshold = msig.thr;
		const subsigs = msig.subsig;

		const addrs = subsigs.map((subsig) => encodeAddress(subsig.pk));
		if (msig.subsig.length < threshold) {
			return false;
		}

		let multiSigaddr;
		try {
			const mparams = {
				version: version,
				threshold: threshold,
				addrs: addrs,
			};
			multiSigaddr = multisigAddress(mparams);
		} catch (e) {
			return false;
		}

		if (accAddr !== multiSigaddr) {
			return false;
		}

		let counter = 0;
		for (const subsig of subsigs) {
			if (!compareArray(subsig.s, new Uint8Array(0))) {
				counter += 1;
			}
		}
		if (counter < threshold) {
			return false;
		}

		let verifiedCounter = 0;
		for (const subsig of subsigs) {
			const subsigAddr = encodeAddress(subsig.pk);
			if (
				!compareArray(subsig.s, new Uint8Array(0)) &&
				verifyBytes(this.logic, subsig.s as Uint8Array, subsigAddr)
			) {
				verifiedCounter += 1;
			}
		}

		return verifiedCounter >= threshold;
	}

	/**
	 * Returns signed logic
	 * @param secretKey: account's secret key
	 */
	signProgram(secretKey: Uint8Array): Uint8Array {
		return signBytes(this.logic, secretKey);
	}

	/**
	 * Returns logic signature address
	 */
	address(): string {
		return this.lsigAddress;
	}

	/**
	 * Returns program associated with logic signature
	 */
	program(): string {
		return convertToString(this.logic);
	}

	/**
	 * Note: following functions are dummy functions
	 * they are used only to match type with algosdk LogicSig
	 * there is a possibility that we may use them in future.
	 */

	toByte(): Uint8Array {
		return this.logic;
	}

	fromByte(val: Uint8Array): LogicSig {
		return new LogicSig("DUMMY", []);
	}

	get_obj_for_encoding(): EncodedLogicSig {
		return {
			l: this.logic,
			arg: this.args,
			sig: this.sig,
			msig: this.msig,
		};
	}

	static from_obj_for_encoding(lsig: EncodedLogicSig): LogicSig {
		return new LogicSig("DUMMY", []);
	}
}

export class LogicSigAccount {
	lsig: LogicSig;
	sigkey?: Uint8Array;

	/**
	 * Create a new LogicSigAccount. By default this will create an escrow
	 * LogicSig account. Call `sign` or `signMultisig` on the newly created
	 * LogicSigAccount to make it a delegated account.
	 *
	 * @param program - program in TEAL file
	 * @param programArgs - An optional array of arguments for the program.
	 */
	constructor(program: string, programArgs?: Array<Uint8Array | Buffer> | null) {
		this.lsig = new LogicSig(program, programArgs);
		this.sigkey = undefined;
	}

	/**
	 * Note: following functions are dummy functions
	 * they are used only to match type with algosdk LogicSigAccount
	 * there is a possibility that we may use them in future.
	 */
	// eslint-disable-next-line camelcase
	get_obj_for_encoding(): EncodedLogicSigAccount {
		return {
			lsig: this.lsig.get_obj_for_encoding(),
			sigkey: this.sigkey,
		};
	}

	// eslint-disable-next-line camelcase
	static from_obj_for_encoding(encoded: EncodedLogicSigAccount): LogicSigAccount {
		const lsigAccount = new LogicSigAccount("DUMMY", encoded.lsig.arg);
		lsigAccount.lsig = LogicSig.from_obj_for_encoding(encoded.lsig);
		lsigAccount.sigkey = encoded.sigkey;
		return lsigAccount;
	}

	toByte(): Uint8Array {
		return this.lsig.toByte();
	}

	static fromByte(encoded: ArrayLike<any>): LogicSigAccount {
		return new LogicSigAccount("DUMMY", []);
	}

	/**
	 * Check if this LogicSigAccount has been delegated to another account with a
	 * signature.
	 *
	 * Note this function only checks for the presence of a delegation signature.
	 * To verify the delegation signature, use `verify`.
	 */
	isDelegated(): boolean {
		return !!(this.lsig.sig ?? this.lsig.msig);
	}

	/**
	 * Verifies this LogicSig's program and signatures.
	 * @returns true if and only if the LogicSig program and signatures are valid.
	 */
	verify(): boolean {
		const addr = this.address();
		return this.lsig.verify(decodeAddress(addr).publicKey);
	}

	/**
	 * Get the address of this LogicSigAccount.
	 *
	 * If the LogicSig is delegated to another account, this will return the
	 * address of that account.
	 *
	 * If the LogicSig is not delegated to another account, this will return an
	 *  escrow address that is the hash of the LogicSig's program code.
	 */
	address(): string {
		if (this.lsig.sig && this.lsig.msig) {
			throw new Error(
				"LogicSig has too many signatures. At most one of sig or msig may be present"
			);
		}

		if (this.lsig.sig) {
			if (!this.sigkey) {
				throw new Error("Signing key for delegated account is missing");
			}
			return encodeAddress(this.sigkey);
		}

		return this.lsig.address();
	}

	/**
	 * Turns this LogicSigAccount into a delegated LogicSig. This type of LogicSig
	 * has the authority to sign transactions on behalf of another account, called
	 * the delegating account. Use this function if the delegating account is a
	 * multisig account.
	 *
	 * @param msig - The multisig delegating account
	 * @param secretKey - The secret key of one of the members of the delegating
	 *   multisig account. Use `appendToMultisig` to add additional signatures
	 *   from other members.
	 */
	signMultisig(msig: MultisigMetadata, secretKey: Uint8Array): void {
		this.lsig.sign(secretKey, msig);
	}

	/**
	 * Adds an additional signature from a member of the delegating multisig
	 * account.
	 *
	 * @param secretKey - The secret key of one of the members of the delegating
	 *   multisig account.
	 */
	appendToMultisig(secretKey: Uint8Array): void {
		this.lsig.appendToMultisig(secretKey);
	}

	/**
	 * Turns this LogicSigAccount into a delegated LogicSig. This type of LogicSig
	 * has the authority to sign transactions on behalf of another account, called
	 * the delegating account. If the delegating account is a multisig account,
	 * use `signMultisig` instead.
	 *
	 * @param secretKey - The secret key of the delegating account.
	 */
	sign(secretKey: Uint8Array): void {
		this.lsig.sign(secretKey);
		this.sigkey = tweet.sign_keyPair_fromSecretKey(secretKey).publicKey;
	}
}
