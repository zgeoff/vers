import { expect, test } from 'bun:test';
import { parseAppState } from './parse-app-state';

test('it reads the deployed SHA and image the whole fleet agrees on', () => {
  const json = [
    {
      config: { env: { GIT_SHA: 'abc123' }, image: 'registry.fly.io/x:tag1' },
      id: 'm1',
      name: 'm1',
      state: 'started',
    },
    {
      config: { env: { GIT_SHA: 'abc123' }, image: 'registry.fly.io/x:tag1' },
      id: 'm2',
      name: 'm2',
      state: 'suspended',
    },
  ];

  expect(parseAppState(json)).toStrictEqual({
    deployedSHA: 'abc123',
    machines: [
      { gitSHA: 'abc123', id: 'm1', state: 'started' },
      { gitSHA: 'abc123', id: 'm2', state: 'suspended' },
    ],
    scheduledMachines: [],
    serviceImage: 'registry.fly.io/x:tag1',
  });
});

test('it treats a fleet with mixed SHAs as having no deployed SHA', () => {
  const json = [
    { config: { env: { GIT_SHA: 'abc123' } }, id: 'm1', name: 'm1', state: 'started' },
    { config: { env: { GIT_SHA: 'def456' } }, id: 'm2', name: 'm2', state: 'started' },
  ];

  expect(parseAppState(json).deployedSHA).toBeNull();
});

test('it treats machines without a stamped SHA as having no deployed SHA', () => {
  const json = [{ config: { env: {} }, id: 'm1', name: 'm1', state: 'started' }];

  expect(parseAppState(json).deployedSHA).toBeNull();
});

test('it treats a fleet with mixed images as having no service image', () => {
  const json = [
    { config: { image: 'registry.fly.io/x:tag1' }, id: 'm1', name: 'm1', state: 'started' },
    { config: { image: 'registry.fly.io/x:tag2' }, id: 'm2', name: 'm2', state: 'started' },
  ];

  expect(parseAppState(json).serviceImage).toBeNull();
});

test('it ignores machines outside the app process group', () => {
  const json = [
    { config: { env: { GIT_SHA: 'abc123' } }, id: 'm1', name: 'm1', state: 'started' },
    {
      config: { env: { GIT_SHA: 'def456' }, metadata: { fly_process_group: 'release_command' } },
      id: 'm2',
      name: 'm2',
      state: 'destroyed',
    },
  ];

  expect(parseAppState(json)).toStrictEqual({
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'started' }],
    scheduledMachines: [],
    serviceImage: null,
  });
});

test('it separates a scheduled machine from the app process group by its schedule, not its metadata', () => {
  const json = [
    {
      config: { env: { GIT_SHA: 'abc123' }, image: 'registry.fly.io/x:tag1' },
      id: 'm1',
      name: 'm1',
      state: 'started',
    },
    {
      config: { image: 'registry.fly.io/x:old', schedule: 'hourly' },
      id: 'm2',
      name: 'sweeper',
      state: 'stopped',
    },
  ];

  expect(parseAppState(json)).toStrictEqual({
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'started' }],
    scheduledMachines: [{ id: 'm2', image: 'registry.fly.io/x:old', name: 'sweeper' }],
    serviceImage: 'registry.fly.io/x:tag1',
  });
});

test('it reads images with the resolved digest stripped', () => {
  const json = [
    {
      config: { env: { GIT_SHA: 'abc123' }, image: 'registry.fly.io/x:tag1' },
      id: 'm1',
      name: 'm1',
      state: 'started',
    },
    {
      config: {
        image: 'registry.fly.io/x:tag1@sha256:753a468f590de55c28f75131897f9242',
        schedule: 'hourly',
      },
      id: 'm2',
      name: 'sweeper',
      state: 'stopped',
    },
  ];

  expect(parseAppState(json)).toStrictEqual({
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'started' }],
    scheduledMachines: [{ id: 'm2', image: 'registry.fly.io/x:tag1', name: 'sweeper' }],
    serviceImage: 'registry.fly.io/x:tag1',
  });
});

test('it parses an empty fleet', () => {
  expect(parseAppState([])).toStrictEqual({
    deployedSHA: null,
    machines: [],
    scheduledMachines: [],
    serviceImage: null,
  });
});
