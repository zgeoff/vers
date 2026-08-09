import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { CatchUpContinuation } from '@vers/contract-activity';
import { createMockCheckpointBatch } from './create-mock-checkpoint-batch';

/**
 * A plain catch-up continuation with faker-generated defaults: a single-entry terminal tail
 * chaining onto a random hash. Pass `checkpoints` built against a real row's own hash chain for a
 * continuation the service will accept.
 */
export function createMockCatchUpContinuation(
  overrides: Readonly<Partial<CatchUpContinuation>> = {},
): CatchUpContinuation {
  const xp = faker.number.int({ max: 500, min: 1 });

  return {
    buildSnapshot: { level: 1, xp },
    checkpoints: createMockCheckpointBatch({
      finalPayloadOverrides: { rewards: { xp }, type: 'completed' },
      startPrevHash: faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' }),
      startVersion: 1,
    }),
    id: `act_${createId()}`,
    startKey: `continue_act_${createId()}`,
    ...overrides,
  };
}
