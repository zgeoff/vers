/**
 * The two separately-rooted avatar roll-key populations: `'trade'` keys are held by the server,
 * `'self-found'` keys are held by the device. Each population derives from its own root secret, so
 * a key from one population never collides with or reveals a key from the other.
 */
export type Population = 'trade' | 'self-found';

export interface WeightedEntry<T> {
  readonly value: T;
  readonly weight: number;
}

/**
 * A deterministic sequence of typed draws expanded from a single digest: equal inputs produce
 * identical draws, and a draw's byte consumption is part of the frozen contract — a degenerate
 * range (`min === max`) consumes no bytes.
 */
export interface RollStream {
  readonly pickWeighted: <T>(entries: ReadonlyArray<WeightedEntry<T>>) => T;
  readonly rollRange: (min: number, max: number) => number;
}
