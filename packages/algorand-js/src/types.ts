import {
  Add, Arg_0, Arg_1, Arg_2,
  Arg_3, Div, Len, Mul, Sub
} from "./interpreter/opcode-list";
import type { IStack } from "./lib/stack";

export type Operator = Len | Add | Sub |
Mul | Div | Arg_0 | Arg_1 | Arg_2 | Arg_3;

export type AppArgs = Array<string | number>;

export type StackElem = bigint | Uint8Array;
export type TEALStack = IStack<bigint | Uint8Array>;
