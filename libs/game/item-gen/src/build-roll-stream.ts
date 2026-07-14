import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import invariant from 'tiny-invariant';
import type { RollStream, WeightedEntry } from './types';

const BLOCK_SIZE = 32;

/**
 * Builds a roll stream over a lazily unbounded byte tape: block `i` is
 * `HKDF-SHA256(ikm: seed, salt: none, info: utf8('${domain}|${i}'), 32)`, so the tape has no
 * length ceiling and every draw derives from `(seed, domain)` alone. The expansion layout and each
 * draw's byte consumption are frozen — changing either forks every consumer's outcomes.
 *
 * `rollRange` is unbiased via rejection sampling over the smallest big-endian byte width covering
 * the span (span ≤ 2^32, so number arithmetic stays exact); a degenerate range returns `min`
 * consuming no bytes. `pickWeighted` draws one `rollRange` over the total weight and walks the
 * entries in given order — callers own deterministic entry ordering.
 */
export function buildRollStream(seed: Uint8Array, domain: string): RollStream {
  let block = new Uint8Array(0);

  let blockIndex = 0;
  let cursor = 0;

  const readByte = (): number => {
    if (cursor === block.length) {
      block = hkdf(sha256, seed, undefined, utf8ToBytes(`${domain}|${blockIndex}`), BLOCK_SIZE);
      blockIndex += 1;
      cursor = 0;
    }

    const byte = block[cursor];

    invariant(byte !== undefined, 'roll-stream cursor must stay inside the current block');

    cursor += 1;

    return byte;
  };

  const rollRange = (min: number, max: number): number => {
    invariant(Number.isSafeInteger(min), 'range min must be a safe integer');
    invariant(Number.isSafeInteger(max), 'range max must be a safe integer');
    invariant(min <= max, 'range min must not exceed max');

    const span = max - min + 1;

    invariant(span <= 2 ** 32, 'range span must not exceed 2^32');

    if (span === 1) {
      return min;
    }

    let width = 1;

    while (256 ** width < span) {
      width += 1;
    }

    const cap = 256 ** width;
    const limit = cap - (cap % span);

    for (;;) {
      let value = 0;

      for (let i = 0; i < width; i += 1) {
        value = value * 256 + readByte();
      }

      if (value < limit) {
        return min + (value % span);
      }
    }
  };

  const pickWeighted = <T>(entries: ReadonlyArray<WeightedEntry<T>>): T => {
    invariant(entries.length > 0, 'weighted pick needs at least one entry');

    let total = 0;

    for (const entry of entries) {
      invariant(
        Number.isSafeInteger(entry.weight) && entry.weight >= 1,
        'weights must be integers of at least 1',
      );

      total += entry.weight;
    }

    invariant(total <= 2 ** 32, 'total weight must not exceed 2^32');

    const roll = rollRange(0, total - 1);
    let cumulative = 0;

    const picked = entries.find((entry) => {
      cumulative += entry.weight;

      return roll < cumulative;
    });

    invariant(picked, 'weighted walk must land within the total');

    return picked.value;
  };

  return { pickWeighted, rollRange };
}
