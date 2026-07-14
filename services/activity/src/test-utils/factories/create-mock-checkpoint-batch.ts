import { faker } from '@faker-js/faker';
import type { CheckpointBatchEntry } from '@vers/contract-activity';
import { buildCheckpointHash } from '@vers/contract-activity';

interface CreateMockCheckpointBatchConfig {
  /**
   * How many entries to build. Default 1.
   */
  readonly count?: number;

  /**
   * Extra fields merged into the last entry's payload — `type`/`rewards` for a batch ending in a
   * terminal checkpoint. Ignored by `buildCheckpointHash`, so the chain stays valid.
   */
  readonly finalPayloadOverrides?: Readonly<Record<string, unknown>>;

  /**
   * The hash the batch's first entry links onto — the activity's current `lastHash` for a batch
   * that will apply cleanly.
   */
  readonly startPrevHash: string;

  /**
   * The activity's `startChainIndex` each entry's `chainIndex` is offset from. Default 0.
   */
  readonly startChainIndex?: number;

  /**
   * The batch's first entry version — the activity's current `appendedHead + 1` for a batch that
   * will apply cleanly.
   */
  readonly startVersion: number;
}

/**
 * Builds a chain-valid checkpoint batch: real hashes computed via `buildCheckpointHash`, each
 * entry linking onto the previous one, starting from a given version and previous hash.
 */
export function createMockCheckpointBatch(
  config: Readonly<CreateMockCheckpointBatchConfig>,
): Array<CheckpointBatchEntry> {
  const count = config.count ?? 1;
  const startChainIndex = config.startChainIndex ?? 0;
  const entries: Array<CheckpointBatchEntry> = [];
  let prevHash = config.startPrevHash;

  for (let index = 0; index < count; index += 1) {
    const version = config.startVersion + index;
    const isLast = index === count - 1;

    const payload = {
      chainIndex: startChainIndex + version,
      entropySource: 'server-key' as const,
      nextSeed: faker.string.alphanumeric({ casing: 'lower', length: 16 }),
      seed: faker.string.alphanumeric({ casing: 'lower', length: 16 }),
      time: version * 1000,
      type: 'tick',
      ...(isLast && config.finalPayloadOverrides),
    };

    const hash = buildCheckpointHash({ ...payload, prevHash, version });

    entries.push({ hash, payload, prevHash, version });

    prevHash = hash;
  }

  return entries;
}
