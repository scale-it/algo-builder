import { Algodv2 } from "algosdk";

export const globalZeroAddress = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";
export const MIN_UINT64 = 0n;
export const MAX_UINT64 = 0xffffffffffffffffn;
export const WAIT_ROUNDS = 6; // for transaction confirmation
// mock algod credentials
export const mockAlgod = new Algodv2("dummyToken", "https://dummyNetwork", 8080);
