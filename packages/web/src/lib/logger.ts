import debug from "debug";

const log = debug("algob/web:log");

const error = debug("algob/web:error");
error.log = console.error.bind(console);

const warn = debug("algob/web:warn");
warn.log = console.warn.bind(console);

debug.enable("algob/web:*");

export { log, error, warn, debug };
