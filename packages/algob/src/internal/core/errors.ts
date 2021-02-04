import { BuilderError } from "@algorand-builder/runtime";
import type { RequestError } from 'algosdk';

import type { AnyMap } from "../../types";
import { getClosestCallerPackage } from "../util/caller-package";
import { ERRORS } from "./errors-list";

export { ERRORS }; // re-export errors-list

// For an explanation about these classes constructors go to:
// https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work

/**
 * This class is used to throw errors from algob plugins.
 */
export class BuilderPluginError extends Error {
  public static isBuilderPluginError(other: any): other is BuilderPluginError { // eslint-disable-line
    return (
      other !== undefined &&
      other !== null &&
      other._isBuilderPluginError === true
    );
  }

  public readonly parent?: Error;
  public readonly pluginName?: string;

  private readonly _isBuilderPluginError: boolean;

  /**
   * Creates a BuilderPluginError.
   *
   * @param pluginName The name of the plugin.
   * @param message An error message that will be shown to the user.
   * @param parent The error that causes this error to be thrown.
   */
  public constructor (pluginName: string, message: string, parent?: Error);

  /**
   * A DEPRECATED constructor that automatically obtains the caller package and
   * use it as plugin name.
   *
   * @deprecated Use the above constructor.
   *
   * @param message An error message that will be shown to the user.
   * @param parent The error that causes this error to be thrown.
   */
  public constructor (message: string, parent?: Error);

  public constructor (
    pluginNameOrMessage: string,
    messageOrParent?: string | Error,
    parent?: Error
  ) {
    if (typeof messageOrParent === "string") {
      super(messageOrParent);
      this.pluginName = pluginNameOrMessage;
      this.parent = parent;
    } else {
      super(pluginNameOrMessage);
      this.pluginName = getClosestCallerPackage();
      this.parent = messageOrParent;
    }

    this._isBuilderPluginError = true;
    Object.setPrototypeOf(this, BuilderPluginError.prototype);
  }
}

export function parseAlgorandError (e: RequestError, ctx: AnyMap): Error {
  if (e === undefined) { return new BuilderError(ERRORS.NETWORK.NODE_IS_NOT_RUNNING); }

  if (e.response?.statusCode !== undefined) {
    if (e.response?.statusCode >= 400 && e.response?.statusCode < 500) {
      return new BuilderError(ERRORS.ALGORAND.BAD_REQUEST, {
        status: e.response?.statusCode,
        message: e.response?.body?.message ?? e.response?.text ?? e.response?.error,
        ctx: JSON.stringify(ctx)
      }, e.error);
    }
    return new BuilderError(ERRORS.ALGORAND.INTERNAL_ERROR, {
      status: e.response?.statusCode
    }, e);
  }
  return e;
}
