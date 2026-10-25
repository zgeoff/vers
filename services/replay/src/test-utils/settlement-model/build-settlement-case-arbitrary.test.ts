import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { buildSettlementCaseArbitrary } from './build-settlement-case-arbitrary';

test('it generates only the listed command kinds, within the command bound', () => {
  const cases = fc.sample(
    buildSettlementCaseArbitrary({ kinds: ['start', 'stop', 'settle-one'], maxCommands: 5 }),
    { numRuns: 200, seed: 7 },
  );

  const kinds = new Set(
    cases.flatMap((generated) => generated.commands.map((command) => command.kind)),
  );

  expect([...kinds]).toIncludeSameMembers(['start', 'stop', 'settle-one']);

  expect(cases.map((generated) => generated.commands.length)).toSatisfyAll(
    (length: number) => length > 0 && length <= 5,
  );
});

test('it generates every command kind when every kind is listed', () => {
  const cases = fc.sample(
    buildSettlementCaseArbitrary({
      kinds: [
        'start',
        'deliver',
        'forge',
        'redeliver',
        'stop',
        'takeover',
        'settle-one',
        'settle-all',
      ],
      maxCommands: 12,
    }),
    { numRuns: 200, seed: 7 },
  );

  const kinds = new Set(
    cases.flatMap((generated) => generated.commands.map((command) => command.kind)),
  );

  expect([...kinds]).toIncludeSameMembers([
    'start',
    'deliver',
    'forge',
    'redeliver',
    'stop',
    'takeover',
    'settle-one',
    'settle-all',
  ]);
});
