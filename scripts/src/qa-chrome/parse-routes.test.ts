import { expect, test } from 'bun:test';
import { parseRoutes } from './parse-routes';

test('it reads the routes that ip -j prints, keeping the fields a replay needs', () => {
  const text = JSON.stringify([
    {
      dev: 'eth0',
      dst: 'default',
      flags: ['onlink'],
      gateway: '10.99.0.1',
      protocol: 'kernel',
    },
    {
      dev: 'eth0',
      dst: '10.20.0.0/20',
      flags: [],
      prefsrc: '10.20.3.7',
      protocol: 'kernel',
      scope: 'link',
    },
    { dev: 'eth0', dst: 'fe80::/64', metric: 256, protocol: 'kernel' },
  ]);

  expect(parseRoutes(text, 'inet')).toStrictEqual([
    {
      dev: 'eth0',
      dst: 'default',
      family: 'inet',
      gateway: '10.99.0.1',
      isOnlink: true,
      metric: null,
      prefsrc: null,
      protocol: 'kernel',
      scope: null,
    },
    {
      dev: 'eth0',
      dst: '10.20.0.0/20',
      family: 'inet',
      gateway: null,
      isOnlink: false,
      metric: null,
      prefsrc: '10.20.3.7',
      protocol: 'kernel',
      scope: 'link',
    },
    {
      dev: 'eth0',
      dst: 'fe80::/64',
      family: 'inet',
      gateway: null,
      isOnlink: false,
      metric: 256,
      prefsrc: null,
      protocol: 'kernel',
      scope: null,
    },
  ]);
});

test('it reads the empty output of a family with no routes as none', () => {
  expect(parseRoutes('', 'inet6')).toStrictEqual([]);
});

test('it rejects a route with no device', () => {
  expect(() => parseRoutes(JSON.stringify([{ dst: 'default' }]), 'inet')).toThrow();
});
