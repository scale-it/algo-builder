import { Algodv2 } from "algosdk";

export const globalZeroAddress = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";
export const MIN_UINT64 = 0n;
export const MAX_UINT64 = 0xFFFFFFFFFFFFFFFFn;
// mock algod credentials
export const mockAlgod = new Algodv2("dummyToken", "dummyNetwork", 8080);
