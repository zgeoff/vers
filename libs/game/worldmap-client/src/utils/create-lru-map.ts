export interface LRUMap<K, V> {
  readonly clear: () => void;
  readonly findValue: (key: K) => undefined | V;
  readonly has: (key: K) => boolean;
  readonly remove: (key: K) => boolean;
  readonly set: (key: K, value: V) => void;
  readonly size: number;
}

export function createLRUMap<K, V>(
  capacity: number,
  onEvict?: (value: V, key: K) => void,
): LRUMap<K, V> {
  const entries = new Map<K, V>();

  return {
    get size() {
      return entries.size;
    },

    clear: () => {
      if (onEvict) {
        for (const [key, value] of entries) {
          onEvict(value, key);
        }
      }

      entries.clear();
    },

    findValue: (key) => {
      const value = entries.get(key);

      if (value !== undefined) {
        entries.delete(key);
        entries.set(key, value);
      }

      return value;
    },

    has: (key) => entries.has(key),

    remove: (key) => {
      const value = entries.get(key);
      const removed = entries.delete(key);

      if (removed && value !== undefined) {
        onEvict?.(value, key);
      }

      return removed;
    },

    set: (key, value) => {
      if (entries.has(key)) {
        entries.delete(key);
      } else if (entries.size >= capacity) {
        const oldestEntry = entries.entries().next().value;

        if (oldestEntry !== undefined) {
          const [oldestKey, oldestValue] = oldestEntry;

          entries.delete(oldestKey);
          onEvict?.(oldestValue, oldestKey);
        }
      }

      entries.set(key, value);
    },
  };
}
