import { expect, test } from 'bun:test';
import { findDefaultInterface } from './find-default-interface';

test('it picks the interface of the IPv4 default route', () => {
  expect(
    findDefaultInterface([
      {
        dev: 'wg0',
        dst: 'default',
        family: 'inet6',
        gateway: 'fe80::1',
        metric: 1024,
        prefsrc: null,
        protocol: null,
        scope: null,
      },
      {
        dev: 'eth0',
        dst: 'default',
        family: 'inet',
        gateway: '10.20.0.1',
        metric: null,
        prefsrc: null,
        protocol: null,
        scope: null,
      },
    ]),
  ).toBe('eth0');
});

test('it falls back to the IPv6 default route', () => {
  expect(
    findDefaultInterface([
      {
        dev: 'wg0',
        dst: 'default',
        family: 'inet6',
        gateway: 'fe80::1',
        metric: 1024,
        prefsrc: null,
        protocol: null,
        scope: null,
      },
    ]),
  ).toBe('wg0');
});

test('it finds no interface without a default route', () => {
  expect(
    findDefaultInterface([
      {
        dev: 'eth0',
        dst: '10.20.0.0/20',
        family: 'inet',
        gateway: null,
        metric: null,
        prefsrc: null,
        protocol: 'kernel',
        scope: 'link',
      },
    ]),
  ).toBeUndefined();
});
