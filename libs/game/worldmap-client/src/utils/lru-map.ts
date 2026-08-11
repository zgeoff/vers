/**
 * A `Map` bounded to `capacity` entries, evicting in least-recently-used order: `set` past the
 * capacity removes the map's oldest entry, and a `get` hit re-inserts its entry so recently read
 * keys survive eviction. A stored `undefined` value is indistinguishable from a miss and gets no
 * recency refresh.
 */
export class LRUMap<K, V> extends Map<K, V> {
  readonly #capacity: number;

  constructor(capacity: number) {
    super();

    this.#capacity = capacity;
  }

  override get(key: K): undefined | V {
    const value = super.get(key);

    if (value === undefined) {
      return undefined;
    }

    super.delete(key);
    super.set(key, value);

    return value;
  }

  override set(key: K, value: V): this {
    if (super.has(key)) {
      super.delete(key);
    } else if (this.size >= this.#capacity) {
      const oldestKey = super.keys().next().value;

      if (oldestKey !== undefined) {
        super.delete(oldestKey);
      }
    }

    return super.set(key, value);
  }
}
