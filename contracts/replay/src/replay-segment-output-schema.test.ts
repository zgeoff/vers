import { expect, test } from 'bun:test';
import { ReplaySegmentOutputSchema } from './replay-segment-output-schema';

test('it accepts an empty checkpoint list with an elapsed duration', () => {
  const result = ReplaySegmentOutputSchema.safeParse({ checkpoints: [], elapsed: 0 });

  expect(result.success).toBeTrue();
});

test('it rejects an output missing the elapsed duration', () => {
  const result = ReplaySegmentOutputSchema.safeParse({ checkpoints: [] });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['elapsed'] }));
});
