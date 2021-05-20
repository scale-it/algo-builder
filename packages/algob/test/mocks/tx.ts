import { Algodv2, SuggestedParams } from "algosdk";

export const mockAlgod = new Algodv2("dummyToken", "dummyNetwork", 8080);

export const mockSuggestedParam: SuggestedParams = {
  flatFee: false,
  fee: 100,
  firstRound: 2,
  lastRound: 100,
  genesisID: 'testnet-v1.0',
  genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='
};
