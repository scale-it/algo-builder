import { types } from "@algo-builder/web";
import { SuggestedParams } from "algosdk";

import { ALGORAND_MIN_TX_FEE } from "../lib/constants";

const GENESIS_ID = "testnet-v1.0";
// testnet-v1.0 hash
const GENESIS_HASH = "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";

export function mockSuggestedParams(payFlags: types.TxParams, round: number): SuggestedParams {
	const s = {} as SuggestedParams;

	if (payFlags.flatFee === undefined) {
		if (payFlags.totalFee !== undefined) s.flatFee = true;
		else s.flatFee = false;
	}
	s.fee = payFlags.totalFee ?? payFlags.feePerByte ?? ALGORAND_MIN_TX_FEE;

	// https://developer.algorand.org/docs/features/transactions/#setting-first-and-last-valid
	s.firstRound = payFlags.firstValid ?? round - 1;
	s.lastRound =
		payFlags.firstValid === undefined || payFlags.validRounds === undefined
			? s.firstRound + 1000
			: Number(payFlags.firstValid) + Number(payFlags.validRounds);

	s.genesisID = GENESIS_ID;
	s.genesisHash = GENESIS_HASH;
	return s;
}
