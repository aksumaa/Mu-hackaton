type Tree = { [key: string]: string | Tree };

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export function defineMessages<T extends Tree>(input: T): Widen<T> {
  return input as unknown as Widen<T>;
}
