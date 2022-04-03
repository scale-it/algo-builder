declare var debug: debug.Debug & { debug: debug.Debug; default: debug.Debug };
declare namespace debug {
	interface Debug {
		(namespace: string): Debugger;
		coerce: (val: any) => any;
		disable: () => string;
		enable: (namespaces: string) => void;
		enabled: (namespaces: string) => boolean;
		formatArgs: (this: Debugger, args: any[]) => void;
		log: (...args: any[]) => any;
		selectColor: (namespace: string) => string | number;
		humanize: typeof import("ms");

		names: RegExp[];
		skips: RegExp[];

		formatters: Formatters;
	}

	type IDebug = Debug;

	interface Formatters {
		[formatter: string]: (v: any) => string;
	}

	type IDebugger = Debugger;

	interface Debugger {
		(formatter: any, ...args: any[]): void;

		color: string;
		diff: number;
		enabled: boolean;
		log: (...args: any[]) => any;
		namespace: string;
		destroy: () => boolean;
		extend: (namespace: string, delimiter?: string) => Debugger;
	}
}

const log = debug("algob/web:log");

const error = debug("algob/web:error");
error.log = console.error.bind(console);

const warn = debug("algob/web:warn");
warn.log = console.warn.bind(console);

debug.enable("algob/web:*");

export { log, error, warn };
