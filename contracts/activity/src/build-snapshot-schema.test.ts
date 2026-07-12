import { expect, test } from 'bun:test';
import { BuildSnapshotSchema } from './build-snapshot-schema';

test('it accepts a well-formed snapshot', () => {
  const result = BuildSnapshotSchema.safeParse({ level: 3, xp: 120 });

  expect(result.success).toBeTrue();
});

test('it rejects a snapshot missing a required field', () => {
  const result = BuildSnapshotSchema.safeParse({ level: 3 });

  expect(result.success).toBeFalse();
});
