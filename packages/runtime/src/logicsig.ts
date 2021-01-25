import {
  decodeAddress, encodeAddress,
  generateAccount, MultiSig, MultiSigAccount,
  multisigAddress, signBytes, verifyBytes
} from "algosdk";
import * as tweet from "tweetnacl-ts";

import { compareArray } from "../src/lib/compare";
import { convertToString, stringToBytes } from "../src/lib/parsing";
import { TealError } from "./errors/errors";
import { ERRORS } from "./errors/errors-list";

/**
 * Note: We cannot use algosdk LogicSig class here,
 * because algosdk.makeLogicSig() takes compiled bytes as a argument
 * and currently we don't calculate compiled bytes from TEAL program.
 * We are using raw TEAL code as program.(by converting string into bytes)
 */
export class LogicSig {
  logic: Uint8Array;
  args: Uint8Array[];
  sig: Uint8Array;
  msig: MultiSig | undefined;
  lsigAddress: string;

  constructor (program: string, args: Uint8Array[]) {
    this.logic = stringToBytes(program);
    this.args = args;
    this.sig = new Uint8Array(0);
    this.msig = undefined;
    this.lsigAddress = generateAccount().addr;
  }

  /**
   * Creates signature (if no msig provided) or multi signature otherwise
   * @param secretKey sender's secret key
   * @param msig multisignature if it exists
   */
  sign (secretKey: Uint8Array, msig?: MultiSigAccount): void {
    if (msig === undefined) {
      this.sig = signBytes(this.logic, secretKey);
    } else {
      const subsigs = msig.addrs.map(addr => {
        return {
          pk: decodeAddress(addr).publicKey,
          s: new Uint8Array(0)
        };
      });
      this.msig = {
        v: msig.version,
        thr: msig.threshold,
        subsig: subsigs
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
  singleSignMultisig (secretKey: Uint8Array, msig: MultiSig): [Uint8Array, number] {
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
      throw new TealError(ERRORS.TEAL.INVALID_SECRET_KEY, { secretkey: secretKey });
    }
    const sig = signBytes(this.logic, secretKey);
    return [sig, index];
  }

  /**
   * Appends a signature to multi signature
   * @param {Uint8Array} secretKey Secret key to sign with
   */
  appendToMultisig (secretKey: Uint8Array): void {
    if (this.msig === undefined) {
      throw new Error("no multisig present");
    }
    const [sig, index] = this.singleSignMultisig(secretKey, this.msig);
    this.msig.subsig[index].s = sig;
  }

  /**
   * Performs signature verification
   * @param accAddr Sender's account address
   */
  verify (accAddr: string): boolean {
    if (compareArray(this.sig, new Uint8Array(0)) && this.msig === undefined) {
      if (accAddr === this.lsigAddress) return true;
      return false;
    }

    if (!compareArray(this.sig, new Uint8Array(0))) {
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
  verifyMultisig (msig: MultiSig, accAddr: string): boolean {
    const version = msig.v;
    const threshold = msig.thr;
    const subsigs = msig.subsig;

    const addrs = subsigs.map(
      (subsig) => encodeAddress(subsig.pk)
    );
    if (msig.subsig.length < threshold) {
      return false;
    }

    let multiSigaddr;
    try {
      const mparams = {
        version: version,
        threshold: threshold,
        addrs: addrs
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
      if (!compareArray(subsig.s, new Uint8Array(0)) && verifyBytes(this.logic, subsig.s, subsigAddr)) {
        verifiedCounter += 1;
      }
    }

    if (verifiedCounter < threshold) {
      return false;
    }

    return true;
  }

  /**
   * Returns logic signature address
   */
  address (): string {
    return this.lsigAddress;
  }

  /**
   * Returns program associated with logic signature
   */
  program (): string {
    return convertToString(this.logic);
  }
}
