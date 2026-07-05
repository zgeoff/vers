type NonNullish<T> = T extends null | undefined ? never : T;

type OmitNullish<T> = Pick<
  T,
  {
    [K in keyof T]: T[K] extends NonNullish<T[K]> ? K : never;
  }[keyof T]
>;

// TODO: extract to central utils
export function omitNullish<T extends object>(obj: T): OmitNullish<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- baseline(#236)
  const result = {} as OmitNullish<T>;

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- baseline(#236)
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const value = obj[key];

    if (value !== null && value !== undefined) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- baseline(#236)
      (result as T)[key] = value;
    }
  }

  return result;
}
