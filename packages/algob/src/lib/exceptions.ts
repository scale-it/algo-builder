import type { Network } from "../types";

export function checkAlgorandUnauthorized (e: any, n: Network): boolean { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (e instanceof Error &&
    (e.message === 'Unauthorized') &&
    (e as any).response?.text === '{"message":"Invalid API Token"}\n') {
    console.error("Wrong credentials to access the Algorand Node. Please verify the access token for the", '"' + n.name + '"', "network.");
    // we finish it here, because we know what's wrong and there is not point
    // to rethrow the exception
    process.exit(1);
  }
  return false;
}
