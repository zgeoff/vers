import { expect, test } from 'bun:test';
import { planColdPath } from './plan-cold-path';

test('it plans a suspend for each warm machine and skips the cold ones', () => {
  const actions = planColdPath(
    'vers-service-activity',
    [
      { checks: [], gitSHA: 'sha', id: 'm1', image: 'img', state: 'started' },
      { checks: [], gitSHA: 'sha', id: 'm2', image: 'img', state: 'suspended' },
      { checks: [], gitSHA: 'sha', id: 'm3', image: 'img', state: 'stopped' },
      { checks: [], gitSHA: 'sha', id: 'm4', image: 'img', state: 'starting' },
    ],
    'suspend',
  );

  expect(actions).toStrictEqual([
    { app: 'vers-service-activity', kind: 'suspend', machineID: 'm1' },
    { app: 'vers-service-activity', kind: 'suspend', machineID: 'm4' },
  ]);
});

test('it plans a stop for an app that parks idle machines by stopping them', () => {
  const actions = planColdPath(
    'vers-service-email',
    [{ checks: [], gitSHA: 'sha', id: 'm1', image: 'img', state: 'started' }],
    'stop',
  );

  expect(actions).toStrictEqual([{ app: 'vers-service-email', kind: 'stop', machineID: 'm1' }]);
});

test('it plans nothing for a fleet that is already cold', () => {
  const actions = planColdPath(
    'vers-service-keys',
    [{ checks: [], gitSHA: 'sha', id: 'm1', image: 'img', state: 'suspended' }],
    'suspend',
  );

  expect(actions).toBeEmpty();
});
