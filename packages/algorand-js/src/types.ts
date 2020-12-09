import {
  Add, Addr, Arg, Byte, Bytec, Bytecblock, Div, Int, Len, Mul, Sub
} from "./interpreter/opcode-list";
import type { IStack } from "./lib/stack";

export type Operator = Len | Add | Sub |
Mul | Div | Arg | Bytecblock | Bytec | Addr | Int | Byte;

export type AppArgs = Array<string | number>;

export type StackElem = bigint | Uint8Array;
export type TEALStack = IStack<bigint | Uint8Array>;

export enum EncodingType {
  BASE64,
  BASE32,
  HEX
}
