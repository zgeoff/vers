import { expect, test } from 'bun:test';
import { registerSatellite } from './register-satellite';
import { useSatelliteStore } from './use-satellite-store';

test('it adds a satellite entry under its id', () => {
  registerSatellite('avatar', { element: 'viewer', keepAlive: false });

  expect(useSatelliteStore.getState().satellites.get('avatar')).toStrictEqual({
    element: 'viewer',
    keepAlive: false,
  });
});

test('it replaces an existing entry registered under the same id', () => {
  registerSatellite('avatar', { element: 'first', keepAlive: false });
  registerSatellite('avatar', { element: 'second', keepAlive: true });

  expect(useSatelliteStore.getState().satellites.get('avatar')).toStrictEqual({
    element: 'second',
    keepAlive: true,
  });
});

test('it leaves other entries untouched when registering a new id', () => {
  registerSatellite('avatar', { element: 'viewer', keepAlive: false });
  registerSatellite('item', { element: 'inspector', keepAlive: false });

  expect(useSatelliteStore.getState().satellites.get('avatar')).toStrictEqual({
    element: 'viewer',
    keepAlive: false,
  });
});
