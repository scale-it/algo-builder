
import { getFunctionName } from "io-ts/lib";

function stringify(v: any): string {  // eslint-disable-line @typescript-eslint/no-explicit-any
  if (typeof v === "function") {
    return getFunctionName(v);
  }
  if (typeof v === "number" && !isFinite(v)) {
    if (isNaN(v)) {
      return "NaN";
    }
    return v > 0 ? "Infinity" : "-Infinity";
  }
  return JSON.stringify(v);
}

export function mkErrorMessage(path: string, value: any, expectedType: string) {  // eslint-disable-line
  return `Invalid value ${stringify(
value
)} for ${path} - Expected a value of type ${expectedType}.`;
}

export default class CfgErrors {
  errors: string[] = [];

  public push(net: string, field: string, val: any, expectedType: string) {  // eslint-disable-line
    this.errors.push(mkErrorMessage(
      `config.networks.${net}.${field}`,
      val,
      expectedType))
  }

  public concatenate(errors: string[]) : void{
    for (const e of errors)
      this.errors.push(e);
  }

  public isEmpty() : boolean {
    return this.errors.length == 0
  }

  public toString() : string {
    return this.errors.join("\n  * ");
  }
}
