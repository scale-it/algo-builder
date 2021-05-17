import { types as rtypes } from "@algo-builder/runtime";
import { mnemonicToSecretKey } from "algosdk";

export const mnemonic1 = "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide";
const a1 = mnemonicToSecretKey(mnemonic1);

export const account1: rtypes.Account = { name: "acc-name-1", addr: a1.addr, sk: a1.sk };

export const bobAcc: rtypes.Account = {
  name: 'bob',
  addr: '2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ',
  sk: new Uint8Array([
    37, 121, 215, 52, 249, 225, 100, 182, 135, 113, 123,
    92, 39, 1, 30, 243, 76, 191, 33, 38, 2, 200,
    206, 143, 49, 186, 130, 68, 68, 173, 97, 199, 210,
    23, 21, 247, 20, 217, 115, 196, 142, 25, 133, 110,
    76, 211, 10, 37, 139, 244, 17, 6, 140, 68, 241,
    49, 27, 245, 85, 35, 13, 128, 151, 138
  ])
};
