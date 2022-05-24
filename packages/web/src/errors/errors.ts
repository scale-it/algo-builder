import type { AnyMap, RequestError } from "../types";
import { ErrorDescriptor, ERRORS, getErrorCode } from "./errors-list";

export { ERRORS }; // re-export errors-list

// For an explanation about these classes constructors go to:
// https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work

export class BuilderError extends Error {
	public static isBuilderError(other: any): other is BuilderError {
		// eslint-disable-line
		return other !== undefined && other !== null && other._isBuilderError === true;
	}

	public readonly errorDescriptor: ErrorDescriptor;
	public readonly number: number;
	public readonly parent?: Error;

	private readonly _isBuilderError: boolean;

	constructor(
		errorDescriptor: ErrorDescriptor,
		messageArguments: AnyMap = {},
		parentError?: Error
	) {
		const prefix = `${getErrorCode(errorDescriptor)}: `;

		const formattedMessage = applyErrorMessageTemplate(
			errorDescriptor.message,
			messageArguments
		);

		super(String(prefix) + String(formattedMessage));
		this.errorDescriptor = errorDescriptor;
		this.number = errorDescriptor.number;

		if (parentError instanceof Error) {
			this.parent = parentError;
		}

		this._isBuilderError = true;
		Object.setPrototypeOf(this, BuilderError.prototype);
	}
}

export function parseAlgorandError(e: RequestError, ctx: AnyMap): Error {
	if (e === undefined) {
		return new BuilderError(ERRORS.NETWORK.NODE_IS_NOT_RUNNING);
	}

	/* eslint-disable @typescript-eslint/prefer-optional-chain */
	if (e.response && e.response.statusCode !== undefined) {
		if (e.response.statusCode >= 400 && e.response.statusCode < 500) {
			return new BuilderError(
				ERRORS.ALGORAND.BAD_REQUEST,
				{
					status: e.response.statusCode,
					message:
						(e.response.body && e.response.body.message) || e.response.text || e.response.error, // // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
					ctx: JSON.stringify(ctx),
				},
				e.error
			);
		}
		return new BuilderError(
			ERRORS.ALGORAND.INTERNAL_ERROR,
			{
				status: e.response.statusCode,
			},
			e
		);
	}
	return e;
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
export function applyErrorMessageTemplate(
	template: string,
	values: { [templateVar: string]: any } // eslint-disable-line @typescript-eslint/no-explicit-any
): string {
	return _applyErrorMessageTemplate(template, values);
}

function _applyErrorMessageTemplate(
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
export function replaceAll(str: string, toReplace: string, replacement: string): string {
	return str.split(toReplace).join(replacement);
}
