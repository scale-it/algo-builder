export function fromEntries<T = any> (entries: Array<[string, any]>): T { // eslint-disable-line @typescript-eslint/no-explicit-any
  return Object.assign(
    {},
    ...entries.map(([name, value]) => ({
      [name]: value
    }))
  );
}
