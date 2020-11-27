export interface IStack<T> {
  push: (item: T) => void
  pop: () => T
  length: () => number
}

export class Stack<T> implements IStack<T> {
  private readonly _store: T[] = [];

  constructor (private readonly capacity: number = 1000) {}

  length (): number {
    return this._store.length;
  }

  push (item: T): void {
    if (this.length() === this.capacity) {
      throw new Error(`Stack overflow: cannot push more items than max capacity ${this.capacity}`);
    }
    this._store.push(item);
  }

  pop (): T {
    if (this.length() === 0) {
      throw new Error("pop from empty stack");
    }
    return this._store.pop() as T;
  }
}
