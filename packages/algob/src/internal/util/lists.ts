
function getLast<T> (ts: T[]): T {
  return ts[ts.length - 1];
}

function getLastSubchild<T> (ts: T[][]): T {
  return getLast(getLast(ts));
}

export function partitionByFn (
  f: (s: string, s1: string) => boolean,
  input: string[]
): string[][] {
  if (input.length === 0) {
    return [];
  }
  var out = [[input[0]]];
  for (const current of input.slice(1)) {
    const last = getLastSubchild(out);
    if (f(last, current)) {
      out.push([current]);
    } else {
      out[out.length - 1].push(current);
    }
  }
  return out;
}
