import { expect, test } from 'bun:test';
import { parseFlyMachines } from './parse-fly-machines';

test('it keeps each machine id and state and drops the other fields', () => {
  expect(
    parseFlyMachines([
      { id: '1781e2db', name: 'quiet-moon', state: 'suspended', region: 'syd' },
      { id: '9080d3ef', name: 'brave-sun', state: 'started', region: 'syd' },
    ]),
  ).toStrictEqual([
    { id: '1781e2db', state: 'suspended' },
    { id: '9080d3ef', state: 'started' },
  ]);
});

test('it rejects a machine without a state', () => {
  expect(() => parseFlyMachines([{ id: '1781e2db', name: 'quiet-moon' }])).toThrow();
});
