import { expect, test } from 'bun:test';
import { checkTarget } from './check-target';
import type { DeployTarget } from './types';

const target: DeployTarget = {
  app: 'vers-service-user',
  configDir: 'services/user',
  trigger: { kind: 'turbo-affected', pkg: '@vers/service-user' },
};

test('it flags an app with no machines', () => {
  const state = { deployedSHA: null, machines: [], scheduledMachines: [], serviceImage: null };

  expect(checkTarget(target, state, null)).toStrictEqual(['no machines exist']);
});

test('it passes a current app with a suspended machine', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'suspended' }],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(target, state, changes)).toBeEmpty();
});

test('it flags an app below its warm-machine floor', () => {
  const warmTarget: DeployTarget = { ...target, minStartedMachines: 1 };

  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'suspended' }],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(warmTarget, state, changes)).toStrictEqual([
    '0 machines started, expected at least 1',
  ]);
});

test('it flags a stale app whose package changed since the deployed SHA', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'started' }],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: ['@vers/service-user'], changedPaths: [] };

  expect(checkTarget(target, state, changes)).toStrictEqual([
    expect.toInclude('@vers/service-user'),
  ]);
});

const emailSweeper = {
  command: ['/usr/local/bin/sweep'],
  name: 'email-sweeper',
  schedule: 'hourly' as const,
};

const emailTarget: DeployTarget = { ...target, scheduledMachines: [emailSweeper] };

test('it flags a declared scheduled machine that does not exist', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'started' }],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(emailTarget, state, changes)).toStrictEqual([
    'scheduled machine email-sweeper missing',
  ]);
});

test('it flags a declared scheduled machine on a different image than the service machines', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'started' }],
    scheduledMachines: [{ id: 'm2', image: 'registry.fly.io/x:old', name: 'email-sweeper' }],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(emailTarget, state, changes)).toStrictEqual([
    'scheduled machine email-sweeper image differs from service machines',
  ]);
});

test('it passes a declared scheduled machine already on the service image', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'started' }],
    scheduledMachines: [{ id: 'm2', image: 'registry.fly.io/x:tag1', name: 'email-sweeper' }],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(emailTarget, state, changes)).toBeEmpty();
});

test('it leaves an app with no scheduled-machine declarations untouched', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'started' }],
    scheduledMachines: [{ id: 'm2', image: 'registry.fly.io/x:old', name: 'some-other-machine' }],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(target, state, changes)).toBeEmpty();
});
