import { expect, test } from 'bun:test';
import { RewardSlotSchema } from './reward-slot-schema';

test('it accepts a well-formed reward slot', () => {
  const result = RewardSlotSchema.safeParse({ context: { nodeTier: 2 }, ordinal: 0 });

  expect(result.success).toBeTrue();
});

test('it rejects a negative ordinal', () => {
  const result = RewardSlotSchema.safeParse({ context: { nodeTier: 1 }, ordinal: -1 });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['ordinal'] }));
});

test('it rejects a node tier below 1', () => {
  const result = RewardSlotSchema.safeParse({ context: { nodeTier: 0 }, ordinal: 0 });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['context', 'nodeTier'] }),
  );
});

test('it rejects a missing context', () => {
  const result = RewardSlotSchema.safeParse({ ordinal: 0 });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['context'] }));
});
