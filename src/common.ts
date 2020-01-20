export interface Dict<V> {
  [key: string]: V;
}

export function ensure<T>(x: T | undefined | null): T {
  if (x === undefined || x === null) {
    throw new Error();
  }
  return x;
}

export const tuple = <T extends any[]>(...args: T): T => args;
