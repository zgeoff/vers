import { expect, test } from 'bun:test';
import { EntropySourceSchema } from './entropy-source-schema';

test('it accepts every declared entropy-source value', () => {
  for (const entropySource of ['server-key', 'device-key']) {
    expect(EntropySourceSchema.safeParse(entropySource).success).toBeTrue();
  }
});

test('it rejects a tag outside the enum', () => {
  const result = EntropySourceSchema.safeParse('chain');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});
