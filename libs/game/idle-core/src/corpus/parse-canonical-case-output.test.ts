import { expect, test } from 'bun:test';
import { parseCanonicalCaseOutput } from './parse-canonical-case-output';

test('it parses a well-formed canonical case string back into its typed shape', () => {
  const canonical = JSON.stringify({
    id: 'parse-fixture',
    elapsed: 1500,
    halted: false,
    checkpointCount: 1,
    checkpoints: [['progress', 1500, 'seed-1', null, 8, [[0, 1]], [2, 3]]],
  });

  expect(parseCanonicalCaseOutput(canonical)).toStrictEqual({
    id: 'parse-fixture',
    elapsed: 1500,
    halted: false,
    checkpointCount: 1,
    checkpoints: [['progress', 1500, 'seed-1', null, 8, [[0, 1]], [2, 3]]],
  });
});

test('it rejects a canonical string whose checkpoint tuple carries the wrong shape', () => {
  const canonical = JSON.stringify({
    id: 'parse-fixture',
    elapsed: 0,
    halted: false,
    checkpointCount: 1,
    checkpoints: [['progress', 'not-a-number']],
  });

  expect(() => parseCanonicalCaseOutput(canonical)).toThrow();
});
