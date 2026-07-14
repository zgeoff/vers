import { expect, test } from 'bun:test';
import { EntropySourceSchema } from './entropy-source-schema';

test('it accepts every declared entropy-source value', () => {
  for (const entropySource of ['server-key', 'device-key']) {
    expect(EntropySourceSchema.safeParse(entropySource).success).toBeTrue();
  }
});

test('it rejects a tag outside the enum', () => {
  expect(EntropySourceSchema.safeParse('chain').success).toBeFalse();
});
