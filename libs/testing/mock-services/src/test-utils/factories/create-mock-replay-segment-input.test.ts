import { expect, test } from 'bun:test';
import { ReplaySegmentInputSchema } from '@vers/contract-replay';
import { createMockReplaySegmentInput } from './create-mock-replay-segment-input';

test('it builds a schema-valid replay segment input', () => {
  const input = createMockReplaySegmentInput();

  expect(ReplaySegmentInputSchema.parse(input)).toStrictEqual(input);
});

test('it applies overrides', () => {
  const input = createMockReplaySegmentInput({ duration: 5000 });

  expect(input.duration).toBe(5000);
});
