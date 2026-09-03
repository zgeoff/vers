export type Population = 'trade' | 'self-found';

export interface WeightedEntry<T> {
  readonly value: T;
  readonly weight: number;
}

export interface RollStream {
  readonly pickWeighted: <T>(entries: ReadonlyArray<WeightedEntry<T>>) => T;
  readonly rollRange: (min: number, max: number) => number;
}
