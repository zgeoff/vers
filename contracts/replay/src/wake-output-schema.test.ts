import { expect, test } from 'bun:test';
import { WakeOutputSchema } from './wake-output-schema';

test('it accepts a drained count of zero', () => {
  const result = WakeOutputSchema.safeParse({ drained: 0 });

  expect(result.success).toBeTrue();
});

test('it rejects a non-integer drained count', () => {
  const result = WakeOutputSchema.safeParse({ drained: 1.5 });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['drained'] }));
});

test('it rejects an output missing the drained count', () => {
  const result = WakeOutputSchema.safeParse({});

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['drained'] }));
});
