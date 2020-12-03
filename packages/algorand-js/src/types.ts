import {
  Add, Arg, Bytec, Bytecblock, Div, Len, Mul, Sub
} from "./interpreter/opcode-list";
import type { IStack } from "./lib/stack";

export type Operator = Len | Add | Sub |
Mul | Div | Arg | Bytecblock | Bytec;

export type AppArgs = Array<string | number>;

export type StackElem = bigint | Uint8Array;
export type TEALStack = IStack<bigint | Uint8Array>;

export enum EncodingType {
  BASE64,
  BASE32,
  HEX
}
