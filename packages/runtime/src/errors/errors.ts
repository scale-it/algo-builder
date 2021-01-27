import { AnyMap } from "../types";
import { ErrorDescriptor, getErrorCode } from "./errors-list";

export class TealError extends Error {
  public static isTealError(other: any): other is TealError { // eslint-disable-line
    return (
      other !== undefined && other !== null && other._isTealError === true
    );
  }

  public readonly errorDescriptor: ErrorDescriptor;
  public readonly number: number;
  public readonly parent?: Error;

  private readonly _isTealError: boolean;

  constructor (
    errorDescriptor: ErrorDescriptor,
    messageArguments: AnyMap = {},
    parentError?: Error
  ) {
    const prefix = `${getErrorCode(errorDescriptor)}: `;

    const formattedMessage = applyErrorMessageTemplate(
      errorDescriptor.message,
      messageArguments
    );

    super(prefix + formattedMessage);
    this.errorDescriptor = errorDescriptor;
    this.number = errorDescriptor.number;

    if (parentError instanceof Error) {
      this.parent = parentError;
    }

    this._isTealError = true;
    Object.setPrototypeOf(this, TealError.prototype);
  }
}

/**
 * This function applies error messages templates like this:
 *
 *  - Template is a string which contains a variable tags. A variable tag is a
 *    a variable name surrounded by %. Eg: %plugin1%
 *  - A variable name is a string of alphanumeric ascii characters.
 *  - Every variable tag is replaced by its value.
 *  - %% is replaced by %.
 *  - Values can't contain variable tags.
 *  - If a variable is not present in the template, but present in the values
 *    object, an error is thrown.
 *
 * @param template The template string.
 * @param values A map of variable names to their values.
 */
export function applyErrorMessageTemplate (
  template: string,
  values: { [templateVar: string]: any } // eslint-disable-line @typescript-eslint/no-explicit-any
): string {
  return _applyErrorMessageTemplate(template, values);
}

function _applyErrorMessageTemplate (
  template: string,
  values: { [templateVar: string]: any } // eslint-disable-line @typescript-eslint/no-explicit-any
): string {
  if (template.includes("%%")) {
    return template
      .split("%%")
      .map((part) => _applyErrorMessageTemplate(part, values))
      .join("%");
  }

  for (const variableName of Object.keys(values)) {
    let value: string;

    if (values[variableName] === undefined) {
      value = "undefined";
    } else if (values[variableName] === null) {
      value = "null";
    } else {
      value = values[variableName].toString();
    }

    if (value === undefined) {
      value = "undefined";
    }

    const variableTag = `%${variableName}%`;
    template = replaceAll(template, variableTag, value);
  }

  return template;
}

/**
 * Replaces all the instances of [[toReplace]] by [[replacement]] in [[str]].
 */
export function replaceAll (
  str: string,
  toReplace: string,
  replacement: string
): string {
  return str.split(toReplace).join(replacement);
}
