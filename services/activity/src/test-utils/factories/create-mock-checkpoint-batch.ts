import { faker } from '@faker-js/faker';
import type { CheckpointBatchEntry } from '@vers/contract-activity';
import { buildCheckpointHash } from '@vers/contract-activity';

interface CreateMockCheckpointBatchConfig {
  readonly count?: number;

  readonly finalPayloadOverrides?: Readonly<Record<string, unknown>>;

  readonly startPrevHash: string;

  readonly startChainIndex?: number;

  readonly startVersion: number;

  readonly timeStepMs?: number;
}

export function createMockCheckpointBatch(
  config: Readonly<CreateMockCheckpointBatchConfig>,
): Array<CheckpointBatchEntry> {
  const count = config.count ?? 1;
  const startChainIndex = config.startChainIndex ?? 0;
  const timeStepMs = config.timeStepMs ?? 1000;
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
      time: version * timeStepMs,
      type: 'tick',
      ...(isLast && config.finalPayloadOverrides),
    };

    const hash = buildCheckpointHash({ ...payload, prevHash, version });

    entries.push({ hash, payload, prevHash, version });

    prevHash = hash;
  }

  return entries;
}
