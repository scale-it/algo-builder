export function isNodeCalledWithoutAScript (): boolean {
  const script = process.argv[1];
  return script === undefined || script.trim() === "";
}

/**
 * Starting at node 10, proxies are shown in the console by default, instead
 * of actually inspecting them. This makes all our lazy loading efforts wicked,
 * so we disable it ni buidler/register.
 */
export function disableReplWriterShowProxy (): void {
  const repl = require("repl"); // eslint-disable-line @typescript-eslint/no-var-requires

  if (repl.writer.options != null) {
    Object.defineProperty(repl.writer.options, "showProxy", {
      value: false,
      writable: false,
      configurable: false
    });
  }
}

// handle top level await
export function preprocess (input: string): string {
  const awaitMatcher = /^(?:\s*(?:(?:let|var|const)\s)?\s*([^=]+)=\s*|^\s*)(await\s[\s\S]*)/;
  const asyncWrapper = (code: string, binder: string): string => {
    const assign = binder ? `global.${binder} = ` : '';
    return `(function(){ async function _wrap() { return ${assign}${code} } return _wrap();})()`;
  };

  // match & transform
  const match = input.match(awaitMatcher);
  if (match) {
    input = `${asyncWrapper(match[2], match[1])}`;
  }
  return input;
}

// check if repl error is recoverable
export function isRecoverableError (error: Error): boolean {
  if (error.name === 'SyntaxError') {
    return /^(Unexpected end of input|Unexpected token)/.test(error.message);
  }
  return false;
}
