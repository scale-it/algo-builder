import algosdk, { Algodv2, ALGORAND_MIN_TX_FEE, SuggestedParams } from "algosdk";

import { ChainType, TxParams } from "../types";
import { betanetURL, mainnetURL, testnetURL } from "./constants";

export function algoexplorerAlgod(chain: string): algosdk.Algodv2 {
	const mainnetAlgoExplorer = new Algodv2("", mainnetURL, "");
	const testnetAlgoExplorer = new Algodv2("", testnetURL, "");
	const betanetAlgoExplorer = new Algodv2("", betanetURL, "");
	switch (chain) {
		case ChainType.MainNet:
			return mainnetAlgoExplorer;
		case ChainType.TestNet:
			return testnetAlgoExplorer;
		case ChainType.BetaNet:
			return betanetAlgoExplorer;
		default:
			throw new Error(`Unknown chain type: ${chain}`);
	}
}

/**
 * Returns blockchain transaction suggested parameters (firstRound, lastRound, fee..)
 * @param algocl an Algorand client, instance of Algodv2, used to communicate with a blockchain node.
 */
export async function getSuggestedParams(algocl: Algodv2): Promise<SuggestedParams> {
	const params = await algocl.getTransactionParams().do();
	const genesisInfo = await algocl.genesis().do();
	// Private chains may have an issue with firstRound
	if (!genesisInfo.devmode && params.firstRound === 0) {
		throw new Error(
			"Suggested params returned 0 as firstRound. Ensure that your node progresses."
		);
	}
	return params;
}

/**
 * Returns a union object of custom transaction params and suggested params.
 * @param algocl an Algorand client, instance of Algodv2, used to communicate with a blockchain node.
 * @param userParams a dict containing custom params defined by the user
 * @param s suggested transaction params
 */
export async function mkTxParams(
	algocl: Algodv2,
	userParams: TxParams,
	s?: SuggestedParams
): Promise<SuggestedParams> {
	if (s === undefined) {
		s = await getSuggestedParams(algocl);
	}

	if (userParams.flatFee === undefined) {
		s.flatFee = userParams.totalFee !== undefined;
	}
	s.fee = userParams.totalFee || userParams.feePerByte || ALGORAND_MIN_TX_FEE; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing

	s.firstRound = userParams.firstValid || s.firstRound; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
	s.lastRound =
		userParams.firstValid === undefined || userParams.validRounds === undefined // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
			? s.lastRound
			: Number(userParams.firstValid) + Number(userParams.validRounds);
	return s;
}
