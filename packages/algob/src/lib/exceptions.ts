import type { Network } from "../types";

export function checkAlgorandUnauthorized (e: any, n: Network): boolean { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (e instanceof Error && (e.message === 'Unauthorized')) {
    console.error("Wrong credentials to access the Algorand Node. Please verify the access token for the", '"' + n.name + '"', "network.");
    return true;
  }
  return false;
}
