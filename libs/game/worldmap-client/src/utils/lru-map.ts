export class LRUMap<K, V> extends Map<K, V> {
  readonly #capacity: number;

  readonly #onEvict: ((value: V, key: K) => void) | undefined;

  constructor(capacity: number, onEvict?: (value: V, key: K) => void) {
    super();

    this.#capacity = capacity;
    this.#onEvict = onEvict;
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
      const oldestEntry = super.entries().next().value;

      if (oldestEntry !== undefined) {
        const [oldestKey, oldestValue] = oldestEntry;

        super.delete(oldestKey);
        this.#onEvict?.(oldestValue, oldestKey);
      }
    }

    return super.set(key, value);
  }

  // oxlint-disable-next-line zgeoff/function-verb -- overrides Map.prototype.delete; the built-in name is the contract this subclass must keep
  override delete(key: K): boolean {
    const value = super.get(key);
    const deleted = super.delete(key);

    if (deleted && value !== undefined) {
      this.#onEvict?.(value, key);
    }

    return deleted;
  }

  // oxlint-disable-next-line zgeoff/function-verb -- overrides Map.prototype.clear; the built-in name is the contract this subclass must keep
  override clear(): void {
    if (this.#onEvict) {
      for (const [key, value] of super.entries()) {
        this.#onEvict(value, key);
      }
    }

    super.clear();
  }
}
