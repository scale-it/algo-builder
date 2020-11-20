import {
  Add, Arg_0, Arg_1, Arg_2,
  Arg_3, Div, Len, Mul, Sub
} from "../internal/interpreter/opcode-list";

export type Operator = Len | Add | Sub |
Mul | Div | Arg_0 | Arg_1 | Arg_2 | Arg_3;

export type AppArgs = Array<string | number>;
export type StackElem = string | bigint;
