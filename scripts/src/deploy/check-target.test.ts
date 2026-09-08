import { expect, test } from 'bun:test';
import { checkTarget } from './check-target';
import type { DeployTarget } from './types';

const target: DeployTarget = {
  app: 'vers-service-user',
  configDir: 'services/user',
  exposure: 'flycast',
  trigger: { kind: 'turbo-affected', pkg: '@vers/service-user' },
};

test('it flags an app with no machines', () => {
  const state = { deployedSHA: null, machines: [], scheduledMachines: [], serviceImage: null };

  expect(checkTarget(target, state, null, {})).toStrictEqual(['no machines exist']);
});

test('it passes a current app with a suspended machine', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', image: 'registry.fly.io/x:tag1', state: 'suspended' }],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(target, state, changes, {})).toBeEmpty();
});

test('it flags an app below its warm-machine floor', () => {
  const warmTarget: DeployTarget = { ...target, minStartedMachines: 1 };

  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', image: 'registry.fly.io/x:tag1', state: 'suspended' }],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(warmTarget, state, changes, {})).toStrictEqual([
    '0 machines started, expected at least 1',
  ]);
});

test('it flags a started machine with a non-passing health check', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'critical' }],
        gitSHA: 'abc123',
        id: 'm1',
        image: 'registry.fly.io/x:tag1',
        state: 'started',
      },
    ],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(target, state, changes, {})).toStrictEqual([
    'machine m1 health check servicecheck-00-http-3000 is critical',
  ]);
});

test('it passes a started machine whose health checks pass', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'passing' }],
        gitSHA: 'abc123',
        id: 'm1',
        image: 'registry.fly.io/x:tag1',
        state: 'started',
      },
    ],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(target, state, changes, {})).toBeEmpty();
});

test('it ignores the checks of a machine parked in its idle state', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'warning' }],
        gitSHA: 'abc123',
        id: 'm1',
        image: 'registry.fly.io/x:tag1',
        state: 'suspended',
      },
    ],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(target, state, changes, {})).toBeEmpty();
});

test('it flags a stale app whose package changed since the deployed SHA', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', image: 'registry.fly.io/x:tag1', state: 'started' }],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: ['@vers/service-user'], changedPaths: [] };

  expect(checkTarget(target, state, changes, {})).toStrictEqual([
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
    machines: [{ gitSHA: 'abc123', id: 'm1', image: 'registry.fly.io/x:tag1', state: 'started' }],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(emailTarget, state, changes, {})).toStrictEqual([
    'scheduled machine email-sweeper missing',
  ]);
});

test('it flags a declared scheduled machine on a different image than the service machines', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', image: 'registry.fly.io/x:tag1', state: 'started' }],
    scheduledMachines: [{ id: 'm2', image: 'registry.fly.io/x:old', name: 'email-sweeper' }],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(emailTarget, state, changes, {})).toStrictEqual([
    'scheduled machine email-sweeper image differs from service machines',
  ]);
});

test('it passes a declared scheduled machine already on the service image', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', image: 'registry.fly.io/x:tag1', state: 'started' }],
    scheduledMachines: [{ id: 'm2', image: 'registry.fly.io/x:tag1', name: 'email-sweeper' }],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(emailTarget, state, changes, {})).toBeEmpty();
});

test('it leaves an app with no scheduled-machine declarations untouched', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', image: 'registry.fly.io/x:tag1', state: 'started' }],
    scheduledMachines: [{ id: 'm2', image: 'registry.fly.io/x:old', name: 'some-other-machine' }],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(target, state, changes, {})).toBeEmpty();
});

test('it flags a mixed-image fleet with the images and their machine counts, not the vague stale reason', () => {
  const state = {
    deployedSHA: null,
    machines: [
      { gitSHA: 'shaOLD', id: 'm2', image: 'registry.fly.io/x:old', state: 'suspended' },
      { gitSHA: 'shaOLD', id: 'm3', image: 'registry.fly.io/x:old', state: 'suspended' },
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'passing' }],
        gitSHA: 'shaNEW',
        id: 'm1',
        image: 'registry.fly.io/x:new',
        state: 'started',
      },
    ],
    scheduledMachines: [],
    serviceImage: null,
  };

  expect(checkTarget(target, state, null, {})).toStrictEqual([
    'fleet splits across 2 images: registry.fly.io/x:new (1 machine), registry.fly.io/x:old (2 machines)',
  ]);
});

test('it flags a machine flyctl reported no image for beside its single-image peers', () => {
  const state = {
    deployedSHA: null,
    machines: [
      { gitSHA: 'abc123', id: 'm1', image: 'registry.fly.io/x:tag1', state: 'started' },
      { gitSHA: null, id: 'm2', image: null, state: 'suspended' },
    ],
    scheduledMachines: [],
    serviceImage: null,
  };

  expect(checkTarget(target, state, null, {})).toStrictEqual([
    'machine(s) m2 report no image — flyctl did not read an image for them',
    'stale: no trustworthy deployed SHA recorded on the fleet',
  ]);
});

test('it still flags no trustworthy deployed SHA on a single-image fleet', () => {
  const state = {
    deployedSHA: null,
    machines: [
      { gitSHA: 'shaA', id: 'm1', image: 'registry.fly.io/x:tag1', state: 'started' },
      { gitSHA: 'shaB', id: 'm2', image: 'registry.fly.io/x:tag1', state: 'started' },
    ],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:tag1',
  };

  expect(checkTarget(target, state, null, {})).toStrictEqual([
    'stale: no trustworthy deployed SHA recorded on the fleet',
  ]);
});

test('it passes a fleet split between the head image and a descendant image whose machines are still booting', () => {
  const state = {
    deployedSHA: null,
    machines: [
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'passing' }],
        gitSHA: 'shaHEAD',
        id: 'm1',
        image: 'registry.fly.io/x:head',
        state: 'started',
      },
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'passing' }],
        gitSHA: 'shaHEAD',
        id: 'm2',
        image: 'registry.fly.io/x:head',
        state: 'started',
      },
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'warning' }],
        gitSHA: 'shaNEXT',
        id: 'm3',
        image: 'registry.fly.io/x:next',
        state: 'started',
      },
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'warning' }],
        gitSHA: 'shaNEXT',
        id: 'm4',
        image: 'registry.fly.io/x:next',
        state: 'started',
      },
    ],
    scheduledMachines: [],
    serviceImage: null,
  };

  const relations = {
    shaHEAD: 'same' as const,
    shaNEXT: 'descendant' as const,
  };

  expect(checkTarget(target, state, null, relations)).toBeEmpty();
});

test('it passes the same split when the booting descendant machines are listed before the head machines', () => {
  const state = {
    deployedSHA: null,
    machines: [
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'warning' }],
        gitSHA: 'shaNEXT',
        id: 'm3',
        image: 'registry.fly.io/x:next',
        state: 'started',
      },
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'passing' }],
        gitSHA: 'shaHEAD',
        id: 'm1',
        image: 'registry.fly.io/x:head',
        state: 'started',
      },
    ],
    scheduledMachines: [],
    serviceImage: null,
  };

  const relations = {
    shaNEXT: 'descendant' as const,
    shaHEAD: 'same' as const,
  };

  expect(checkTarget(target, state, null, relations)).toBeEmpty();
});

test('it passes a fleet entirely on a descendant image while its machines boot', () => {
  const state = {
    deployedSHA: 'shaNEXT',
    machines: [
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'warning' }],
        gitSHA: 'shaNEXT',
        id: 'm1',
        image: 'registry.fly.io/x:next',
        state: 'started',
      },
    ],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:next',
  };

  const changes = { affectedPkgs: [], changedPaths: [] };
  const relations = { shaNEXT: 'descendant' as const };

  expect(checkTarget(target, state, changes, relations)).toBeEmpty();
});

test('it flags a booting descendant machine when a head machine is unhealthy', () => {
  const state = {
    deployedSHA: null,
    machines: [
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'critical' }],
        gitSHA: 'shaHEAD',
        id: 'm1',
        image: 'registry.fly.io/x:head',
        state: 'started',
      },
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'warning' }],
        gitSHA: 'shaNEXT',
        id: 'm2',
        image: 'registry.fly.io/x:next',
        state: 'started',
      },
    ],
    scheduledMachines: [],
    serviceImage: null,
  };

  const relations = {
    shaHEAD: 'same' as const,
    shaNEXT: 'descendant' as const,
  };

  expect(checkTarget(target, state, null, relations)).toStrictEqual([
    'machine m1 health check servicecheck-00-http-3000 is critical',
    'machine m2 health check servicecheck-00-http-3000 is warning',
  ]);
});

test('it flags a critical check on a descendant machine even mid-rollout', () => {
  const state = {
    deployedSHA: null,
    machines: [
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'passing' }],
        gitSHA: 'shaHEAD',
        id: 'm1',
        image: 'registry.fly.io/x:head',
        state: 'started',
      },
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'critical' }],
        gitSHA: 'shaNEXT',
        id: 'm2',
        image: 'registry.fly.io/x:next',
        state: 'started',
      },
    ],
    scheduledMachines: [],
    serviceImage: null,
  };

  const relations = {
    shaHEAD: 'same' as const,
    shaNEXT: 'descendant' as const,
  };

  expect(checkTarget(target, state, null, relations)).toStrictEqual([
    'machine m2 health check servicecheck-00-http-3000 is critical',
  ]);
});

test('it still flags a split that includes an image behind head', () => {
  const state = {
    deployedSHA: null,
    machines: [
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'passing' }],
        gitSHA: 'shaHEAD',
        id: 'm1',
        image: 'registry.fly.io/x:head',
        state: 'started',
      },
      {
        checks: [{ name: 'servicecheck-00-http-3000', status: 'warning' }],
        gitSHA: 'shaOLD',
        id: 'm2',
        image: 'registry.fly.io/x:old',
        state: 'started',
      },
    ],
    scheduledMachines: [],
    serviceImage: null,
  };

  const relations = {
    shaHEAD: 'same' as const,
    shaOLD: 'ancestor' as const,
  };

  expect(checkTarget(target, state, null, relations)).toStrictEqual([
    'machine m2 health check servicecheck-00-http-3000 is warning',
    'fleet splits across 2 images: registry.fly.io/x:head (1 machine), registry.fly.io/x:old (1 machine)',
  ]);
});

test('it still flags a split between a descendant image and one off the head lineage', () => {
  const state = {
    deployedSHA: null,
    machines: [
      { gitSHA: 'shaNEXT', id: 'm1', image: 'registry.fly.io/x:next', state: 'started' },
      { gitSHA: 'shaTOPIC', id: 'm2', image: 'registry.fly.io/x:topic', state: 'started' },
    ],
    scheduledMachines: [],
    serviceImage: null,
  };

  const relations = {
    shaNEXT: 'descendant' as const,
    shaTOPIC: 'diverged' as const,
  };

  expect(checkTarget(target, state, null, relations)).toStrictEqual([
    'fleet splits across 2 images: registry.fly.io/x:next (1 machine), registry.fly.io/x:topic (1 machine)',
  ]);
});

test('it still flags a split when a machine carries no git SHA', () => {
  const state = {
    deployedSHA: null,
    machines: [
      { gitSHA: 'shaNEXT', id: 'm1', image: 'registry.fly.io/x:next', state: 'started' },
      { gitSHA: null, id: 'm2', image: 'registry.fly.io/x:bare', state: 'started' },
    ],
    scheduledMachines: [],
    serviceImage: null,
  };

  const relations = { shaNEXT: 'descendant' as const };

  expect(checkTarget(target, state, null, relations)).toStrictEqual([
    'fleet splits across 2 images: registry.fly.io/x:bare (1 machine), registry.fly.io/x:next (1 machine)',
  ]);
});
