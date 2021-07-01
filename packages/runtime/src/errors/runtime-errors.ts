import { applyErrorMessageTemplate } from "@algo-builder/web";

import { AnyMap } from "../types";
import { ErrorDescriptor, getRuntimeErrorCode } from "./errors-list";

export class RuntimeError extends Error {
  public static isRuntimeError(other: any): other is RuntimeError { // eslint-disable-line
    return (
      other !== undefined && other !== null && other._isRuntimeError === true
    );
  }

  public readonly errorDescriptor: ErrorDescriptor;
  public readonly number: number;
  public readonly parent?: Error;

  private readonly _isRuntimeError: boolean;

  constructor (
    errorDescriptor: ErrorDescriptor,
    messageArguments: AnyMap = {},
    parentError?: Error
  ) {
    const prefix = `${getRuntimeErrorCode(errorDescriptor)}: `;

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

    this._isRuntimeError = true;
    Object.setPrototypeOf(this, RuntimeError.prototype);
  }
}
