import {
	betanetGenesisHash,
	mainnetGenesisHash,
	runtimeGenesisHash,
	testnetGenesisHash,
} from "./constants";

/**
 * Queris the genesish hash based on the network name
 * @param networkName string name of the network
 * @returns if the network is known the genesisHash otherwise returns undefined
 */
export function getGenesisHashFromName(networkName: string): string | undefined {
	switch (networkName) {
		case "mainnet":
			return mainnetGenesisHash;
		case "testnet":
			return testnetGenesisHash;
		case "betanet":
			return betanetGenesisHash;
		case "runtime":
			return runtimeGenesisHash;
		default:
			return undefined;
	}
}
