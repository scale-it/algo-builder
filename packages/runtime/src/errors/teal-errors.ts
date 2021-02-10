import { AnyMap } from "../types";
import { ErrorDescriptor, getTealErrorCode } from "./errors-list";
import { applyErrorMessageTemplate } from "./runtime-errors";

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
    const prefix = `${getTealErrorCode(errorDescriptor)}: `;

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
