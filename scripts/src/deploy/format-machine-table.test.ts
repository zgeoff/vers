import { expect, test } from 'bun:test';
import { formatMachineTable } from './format-machine-table';

test('it renders one column-aligned line per machine', () => {
  const machines = [
    { checks: [], gitSHA: 'abc123', id: 'm1', image: 'registry.fly.io/x:tag1', state: 'started' },
    { checks: [], gitSHA: null, id: 'machine-2', image: null, state: 'suspended' },
  ];

  expect(formatMachineTable(machines)).toBe(
    [
      'm1         started    registry.fly.io/x:tag1  abc123',
      'machine-2  suspended  -                       -',
    ].join('\n'),
  );
});

test('it renders an empty string for an empty fleet', () => {
  expect(formatMachineTable([])).toBe('');
});
