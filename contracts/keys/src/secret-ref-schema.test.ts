import { expect, test } from 'bun:test';
import { SecretRefSchema } from './secret-ref-schema';

test('it accepts every declared secret ref value', () => {
  for (const secretRef of ['worldmap']) {
    expect(SecretRefSchema.safeParse(secretRef).success).toBeTrue();
  }
});

test('it rejects a secret ref outside the enum', () => {
  const result = SecretRefSchema.safeParse('rogue');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});
