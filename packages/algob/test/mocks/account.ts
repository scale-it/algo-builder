import { types as rtypes } from "@algo-builder/runtime";
import { mnemonicToSecretKey } from "algosdk";

export const mnemonic1 =
	"call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide";
const a1 = mnemonicToSecretKey(mnemonic1);

export const account1: rtypes.Account = { name: "acc-name-1", addr: a1.addr, sk: a1.sk };

export const bobAcc: rtypes.Account = {
	name: "bob",
	addr: "2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ",
	sk: new Uint8Array([
		37, 121, 215, 52, 249, 225, 100, 182, 135, 113, 123, 92, 39, 1, 30, 243, 76, 191, 33, 38, 2,
		200, 206, 143, 49, 186, 130, 68, 68, 173, 97, 199, 210, 23, 21, 247, 20, 217, 115, 196, 142,
		25, 133, 110, 76, 211, 10, 37, 139, 244, 17, 6, 140, 68, 241, 49, 27, 245, 85, 35, 13, 128,
		151, 138,
	]),
};

export const aliceAcc: rtypes.Account = {
	name: "alice",
	addr: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
	sk: new Uint8Array([
		3, 169, 134, 121, 53, 133, 5, 224, 60, 164, 154, 221, 134, 50, 59, 233, 234, 228, 20, 217,
		47, 234, 40, 26, 33, 55, 90, 26, 66, 141, 7, 85, 81, 88, 241, 118, 22, 102, 228, 46, 242,
		255, 165, 169, 111, 58, 67, 114, 39, 179, 239, 0, 237, 28, 42, 0, 154, 0, 73, 27, 226, 74,
		204, 187,
	]),
};
