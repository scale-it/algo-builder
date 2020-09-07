
function getLast<T> (ts: T[]): T {
  return ts[ts.length - 1];
}

// Takes out the rightest child of a list
// `[[a, b], [c, d]]` would produce `d`
function getLastDeepChild<T> (ts: T[][]): T {
  return getLast(getLast(ts));
}

export function partitionByFn<T> (
  f: (s: T, s1: T) => boolean,
  input: T[]
): T[][] {
  if (input.length === 0) {
    return [];
  }
  var out = [[input[0]]];
  for (const current of input.slice(1)) {
    const last = getLastDeepChild(out);
    if (f(last, current)) {
      out.push([current]);
    } else {
      out[out.length - 1].push(current);
    }
  }
  return out;
}
