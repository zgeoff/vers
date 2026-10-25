import fc from 'fast-check';
import type { SettlementCase, SettlementCommand } from './types';

interface BuildSettlementCaseArbitraryOptions {
  readonly kinds: ReadonlyArray<SettlementCommand['kind']>;
  readonly maxCommands: number;
}

const DEVICE = fc.constantFrom('device-a', 'device-b');

export function buildSettlementCaseArbitrary(
  options: Readonly<BuildSettlementCaseArbitraryOptions>,
): fc.Arbitrary<SettlementCase> {
  const commandsByKind: ReadonlyArray<{
    readonly arbitrary: fc.Arbitrary<SettlementCommand>;
    readonly kind: SettlementCommand['kind'];
    readonly weight: number;
  }> = [
    {
      arbitrary: fc.record({
        // a short run stops part way through its encounter, and a long one reaches a terminal
        durationMs: fc.constantFrom(12_000, 45_000),
        genesis: fc.integer({ max: 2 ** 31 - 1, min: 0 }),
        kind: fc.constant('start'),
        scopeID: fc.constantFrom('0_0', '1_0'),
      }),
      kind: 'start',
      weight: 3,
    },
    {
      arbitrary: fc.record({
        count: fc.integer({ max: 3, min: 1 }),
        device: DEVICE,
        kind: fc.constant('deliver'),
      }),
      kind: 'deliver',
      weight: 2,
    },
    {
      arbitrary: fc.record({
        count: fc.integer({ max: 3, min: 1 }),
        device: DEVICE,
        kind: fc.constant('forge'),
      }),
      kind: 'forge',
      weight: 1,
    },
    {
      arbitrary: fc.record({
        count: fc.integer({ max: 3, min: 1 }),
        device: DEVICE,
        kind: fc.constant('redeliver'),
        skip: fc.integer({ max: 2, min: 0 }),
      }),
      kind: 'redeliver',
      weight: 1,
    },
    {
      arbitrary: fc.record({ device: DEVICE, kind: fc.constant('stop') }),
      kind: 'stop',
      weight: 3,
    },
    {
      arbitrary: fc.record({ device: DEVICE, kind: fc.constant('takeover') }),
      kind: 'takeover',
      weight: 1,
    },
    { arbitrary: fc.constant({ kind: 'settle-one' }), kind: 'settle-one', weight: 2 },
    { arbitrary: fc.constant({ kind: 'settle-all' }), kind: 'settle-all', weight: 1 },
  ];

  const command = fc.oneof(
    ...commandsByKind
      .filter((entry) => options.kinds.includes(entry.kind))
      .map((entry) => ({ arbitrary: entry.arbitrary, weight: entry.weight })),
  );

  return fc.record({
    avatarSeed: fc.integer({ max: 2 ** 31 - 1, min: 0 }),
    commands: fc.array(command, { maxLength: options.maxCommands, minLength: 1, size: 'max' }),
  });
}
