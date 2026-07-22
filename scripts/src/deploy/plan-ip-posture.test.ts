import { expect, test } from 'bun:test';
import { planIPPosture } from './plan-ip-posture';

test('it plans a flycast allocation for a flycast entry with no private address', () => {
  const plan = planIPPosture({ app: 'vers-service-user', exposure: 'flycast', ips: [] });

  expect(plan).toStrictEqual({
    actions: [{ app: 'vers-service-user', kind: 'allocate-flycast-ip' }],
    violations: ['missing its flycast address'],
  });
});

test('it plans an allocation and reports both violations for a flycast entry holding only public addresses', () => {
  const plan = planIPPosture({
    app: 'vers-service-replay',
    exposure: 'flycast',
    ips: [{ address: '2a09:8280:1::14b:f272:0', type: 'public' }],
  });

  expect(plan).toStrictEqual({
    actions: [{ app: 'vers-service-replay', kind: 'allocate-flycast-ip' }],
    violations: [
      'missing its flycast address',
      'public address 2a09:8280:1::14b:f272:0 on a flycast-only app',
    ],
  });
});

test('it reports a violation for a public address on a flycast entry that already has its private one', () => {
  const plan = planIPPosture({
    app: 'vers-service-keys',
    exposure: 'flycast',
    ips: [
      { address: 'fdaa:97:5621:0:1::4', type: 'private' },
      { address: '2a09:8280:1::14b:e98a:0', type: 'public' },
    ],
  });

  expect(plan).toStrictEqual({
    actions: [],
    violations: ['public address 2a09:8280:1::14b:e98a:0 on a flycast-only app'],
  });
});

test('it finds nothing for a public entry regardless of what addresses it holds', () => {
  const plan = planIPPosture({
    app: 'vers-app-web',
    exposure: 'public',
    ips: [
      { address: '2a09:8280:1::145:fe12:0', type: 'public' },
      { address: '66.241.124.240', type: 'public' },
    ],
  });

  expect(plan).toStrictEqual({ actions: [], violations: [] });
});

test('it plans nothing for a flycast entry that already holds only its private address', () => {
  const plan = planIPPosture({
    app: 'vers-service-avatar',
    exposure: 'flycast',
    ips: [{ address: 'fdaa:97:5621:0:1::2', type: 'private' }],
  });

  expect(plan).toStrictEqual({ actions: [], violations: [] });
});
