import { expect, test } from 'bun:test';
import { registerSatellite } from './register-satellite';
import { removeSatellite } from './remove-satellite';
import { useSatelliteStore } from './use-satellite-store';

test('it removes a registered satellite entry', () => {
  registerSatellite('avatar', { element: 'viewer', keepAlive: false });

  removeSatellite('avatar');

  expect(useSatelliteStore.getState().satellites.has('avatar')).toBeFalse();
});

test('it leaves other entries untouched', () => {
  registerSatellite('avatar', { element: 'viewer', keepAlive: false });
  registerSatellite('item', { element: 'inspector', keepAlive: false });

  removeSatellite('avatar');

  expect(useSatelliteStore.getState().satellites.has('item')).toBeTrue();
});

test('it does nothing when the id was never registered', () => {
  expect(() => {
    removeSatellite('missing');
  }).not.toThrow();
});
