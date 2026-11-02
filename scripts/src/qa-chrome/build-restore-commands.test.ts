import { expect, test } from 'bun:test';
import { buildRestoreCommands } from './build-restore-commands';

test('it brings the link up, then replays link routes before gateway routes', () => {
  expect(
    buildRestoreCommands({
      interfaceName: 'eth0',
      routes: [
        {
          dev: 'eth0',
          dst: 'default',
          family: 'inet',
          gateway: '10.20.0.1',
          isOnlink: false,
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
          family: 'inet6',
          gateway: null,
          isOnlink: false,
          metric: 256,
          prefsrc: null,
          protocol: 'kernel',
          scope: null,
        },
      ],
    }),
  ).toStrictEqual([
    ['ip', 'link', 'set', 'dev', 'eth0', 'up'],
    [
      'ip',
      '-4',
      'route',
      'replace',
      '10.20.0.0/20',
      'dev',
      'eth0',
      'proto',
      'kernel',
      'scope',
      'link',
      'src',
      '10.20.3.7',
    ],
    [
      'ip',
      '-6',
      'route',
      'replace',
      'fe80::/64',
      'dev',
      'eth0',
      'proto',
      'kernel',
      'metric',
      '256',
    ],
    [
      'ip',
      '-4',
      'route',
      'replace',
      'default',
      'via',
      '10.20.0.1',
      'dev',
      'eth0',
      'proto',
      'kernel',
    ],
  ]);
});

test('it replays the onlink flag of a gateway outside the subnet', () => {
  expect(
    buildRestoreCommands({
      interfaceName: 'eth0',
      routes: [
        {
          dev: 'eth0',
          dst: 'default',
          family: 'inet',
          gateway: '10.99.0.1',
          isOnlink: true,
          metric: null,
          prefsrc: null,
          protocol: null,
          scope: null,
        },
      ],
    }),
  ).toStrictEqual([
    ['ip', 'link', 'set', 'dev', 'eth0', 'up'],
    ['ip', '-4', 'route', 'replace', 'default', 'via', '10.99.0.1', 'dev', 'eth0', 'onlink'],
  ]);
});
