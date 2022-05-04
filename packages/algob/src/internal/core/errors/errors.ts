import { getClosestCallerPackage } from "../../util/caller-package";

/**
 * This class is used to throw errors from algob plugins.
 */
export class BuilderPluginError extends Error {
	public static isBuilderPluginError(other: any): other is BuilderPluginError {
		// eslint-disable-line
		return other !== undefined && other !== null && other._isBuilderPluginError === true;
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
	public constructor(pluginName: string, message: string, parent?: Error);

	/**
	 * A DEPRECATED constructor that automatically obtains the caller package and
	 * use it as plugin name.
	 *
	 * @deprecated Use the above constructor.
	 *
	 * @param message An error message that will be shown to the user.
	 * @param parent The error that causes this error to be thrown.
	 */
	public constructor(message: string, parent?: Error);

	public constructor(
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
