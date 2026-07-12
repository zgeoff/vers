import { expect, test } from 'bun:test';
import { planScheduledMachineActions } from './plan-scheduled-machine-actions';
import type { ScheduledMachine } from './types';

const sweeper: ScheduledMachine = {
  command: ['/usr/local/bin/sweep'],
  name: 'email-sweeper',
  region: 'syd',
  schedule: 'hourly',
};

test('it creates a declared machine absent from the existing fleet', () => {
  const actions = planScheduledMachineActions([sweeper], 'registry.fly.io/x:tag1', []);

  expect(actions).toStrictEqual([
    { image: 'registry.fly.io/x:tag1', kind: 'create', machine: sweeper },
  ]);
});

test('it updates a declared machine whose image differs from the target', () => {
  const existing = [{ id: 'm1', image: 'registry.fly.io/x:old', name: 'email-sweeper' }];
  const actions = planScheduledMachineActions([sweeper], 'registry.fly.io/x:new', existing);

  expect(actions).toStrictEqual([
    { image: 'registry.fly.io/x:new', kind: 'update-image', machineID: 'm1' },
  ]);
});

test('it takes no action for a declared machine already on the target image', () => {
  const existing = [{ id: 'm1', image: 'registry.fly.io/x:tag1', name: 'email-sweeper' }];
  const actions = planScheduledMachineActions([sweeper], 'registry.fly.io/x:tag1', existing);

  expect(actions).toBeEmpty();
});

test('it plans a mix of create, update, and no-op actions across declarations', () => {
  const current: ScheduledMachine = { ...sweeper, name: 'current-sweeper' };
  const stale: ScheduledMachine = { ...sweeper, name: 'stale-sweeper' };
  const missing: ScheduledMachine = { ...sweeper, name: 'missing-sweeper' };

  const existing = [
    { id: 'm1', image: 'registry.fly.io/x:tag1', name: 'current-sweeper' },
    { id: 'm2', image: 'registry.fly.io/x:old', name: 'stale-sweeper' },
  ];

  const actions = planScheduledMachineActions(
    [current, stale, missing],
    'registry.fly.io/x:tag1',
    existing,
  );

  expect(actions).toStrictEqual([
    { image: 'registry.fly.io/x:tag1', kind: 'update-image', machineID: 'm2' },
    { image: 'registry.fly.io/x:tag1', kind: 'create', machine: missing },
  ]);
});

test('it never leaks state between separate planning calls', () => {
  const existingForOtherApp = [
    { id: 'other-app-machine', image: 'registry.fly.io/other:tag', name: 'email-sweeper' },
  ];

  const actionsForThisApp = planScheduledMachineActions([sweeper], 'registry.fly.io/x:tag1', []);

  const actionsForOtherApp = planScheduledMachineActions(
    [sweeper],
    'registry.fly.io/other:tag',
    existingForOtherApp,
  );

  expect(actionsForThisApp).toStrictEqual([
    { image: 'registry.fly.io/x:tag1', kind: 'create', machine: sweeper },
  ]);

  expect(actionsForOtherApp).toBeEmpty();
});
