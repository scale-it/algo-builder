import {
  Account, decodeAddress, encodeAddress,
  generateAccount, MultiSig, MultiSigAccount,
  multisigAddress, signBytes, verifyBytes
} from "algosdk";

import { compareArray } from "../src/lib/compare";
import { convertToString, stringToBytes } from "../src/lib/parsing";

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
  SignatureAddress: string;

  constructor (program: string, args: Uint8Array[]) {
    this.logic = stringToBytes(program);
    this.args = args;
    this.sig = new Uint8Array(0);
    this.msig = undefined;
    this.SignatureAddress = generateAccount().addr;
  }

  /**
   * Creates signature (if no msig provided) or multi signature otherwise
   * @param secretKey sender's secret key
   */
  sign (account: Account, msig?: MultiSigAccount): void {
    if (msig === undefined) {
      this.sig = signBytes(this.logic, account.sk);
    } else {
      const subsigs = msig.addrs.map(addr => {
        return { pk: decodeAddress(addr).publicKey, s: new Uint8Array(0) };
      });
      this.msig = {
        v: msig.version,
        thr: msig.threshold,
        subsig: subsigs
      };

      const [sig, index] = this.singleSignMultisig(account, this.msig);
      this.msig.subsig[index].s = sig;
    }
  }

  /**
   * Sign Multisignature
   * @param account Account
   * @param msig Multisignature
   */
  singleSignMultisig (account: Account, msig: MultiSig): [Uint8Array, number] {
    let index = -1;
    const accountPk = decodeAddress(account.addr).publicKey;
    for (let i = 0; i < msig.subsig.length; i++) {
      const pk = msig.subsig[i].pk;
      if (compareArray(pk, passedPk)) {
        index = i;
        break;
      }
    }
    if (index === -1) {
      throw new Error("invalid secret key");
    }
    const sig = signBytes(this.logic, account.sk);
    return [sig, index];
  }

  /**
   * Appends a signature to multi signature
   * @param {Uint8Array} secretKey Secret key to sign with
   */
  appendToMultisig (account: Account): void {
    if (this.msig === undefined) {
      throw new Error("no multisig present");
    }
    const [sig, index] = this.singleSignMultisig(account, this.msig);
    this.msig.subsig[index].s = sig;
  }

  /**
   * Performs signature verification
   * @param accAddr Sender's account address
   */
  verify (accAddr: string): boolean {
    if (compareArray(this.sig, new Uint8Array(0)) && this.msig === undefined) {
      if (accAddr === this.SignatureAddress) return true;
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
   * @param publicKey Public key of sender
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
    return this.SignatureAddress;
  }

  /**
   * Returns program associated with logic signature
   */
  program (): string {
    return convertToString(this.logic);
  }
}
