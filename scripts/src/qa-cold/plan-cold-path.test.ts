import { expect, test } from 'bun:test';
import { createMockAppMachine } from '../test-utils/factories/create-mock-app-machine';
import { planColdPath } from './plan-cold-path';

test('it plans a suspend for each warm machine and skips the cold ones', () => {
  const actions = planColdPath(
    'vers-service-activity',
    [
      createMockAppMachine({ id: 'm1', state: 'started' }),
      createMockAppMachine({ id: 'm2', state: 'suspended' }),
      createMockAppMachine({ id: 'm3', state: 'stopped' }),
      createMockAppMachine({ id: 'm4', state: 'starting' }),
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
    [createMockAppMachine({ id: 'm1', state: 'started' })],
    'stop',
  );

  expect(actions).toStrictEqual([{ app: 'vers-service-email', kind: 'stop', machineID: 'm1' }]);
});

test('it plans nothing for a fleet that is already cold', () => {
  const actions = planColdPath(
    'vers-service-keys',
    [createMockAppMachine({ id: 'm1', state: 'suspended' })],
    'suspend',
  );

  expect(actions).toBeEmpty();
});
