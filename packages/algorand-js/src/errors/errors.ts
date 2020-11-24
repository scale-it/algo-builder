import { applyErrorMessageTemplate } from "algob/src/internal/core/errors";
import type { AnyMap } from "algob/src/types";

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
