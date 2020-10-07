
function stringify (v: any): string { // eslint-disable-line @typescript-eslint/no-explicit-any
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
  prefix: string;

  constructor (prefix = "config.networks") {
    this.prefix = prefix;
  }

  public push(net: string, field: string, val: any, expectedType: string) {  // eslint-disable-line
    this.errors.push(mkErrorMessage(
      `${this.prefix}.${net}.${field}`,
      val,
      expectedType));
  }

  public concatenate (errors: string[]): void{
    for (const e of errors) { this.errors.push(e); }
  }

  public isEmpty (): boolean {
    return this.errors.length === 0;
  }

  public toString (): string {
    return this.errors.join("\n  * ");
  }

  public putter (net: string, field: string): ErrorPutter {
    return new ErrorPutter(this, net, field);
  }
}

export class ErrorPutter {
  errs: CfgErrors;
  net: string;
  field: string;
  public isEmpty = true;

  constructor (errs: CfgErrors, net: string, field: string) {
    this.errs = errs;
    this.net = net;
    this.field = field;
  }

  // wraps CfgErrors.put and always returns false.
  public push(field: string, val: any, expectedType: string): boolean { // eslint-disable-line
    if (field === "") { field = this.field; } else { field = this.field + "." + field; }
    this.errs.push(this.net, field, val, expectedType);
    this.isEmpty = false;
    return false;
  }
}
