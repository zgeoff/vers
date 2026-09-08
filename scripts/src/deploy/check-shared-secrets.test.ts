import { expect, test } from 'bun:test';
import { checkSharedSecrets } from './check-shared-secrets';

test('it finds nothing when every declaring app holds the same digest', () => {
  const findings = checkSharedSecrets([
    {
      app: 'vers-service-activity',
      secrets: [{ digest: '237eb2558e3b4f0a9c1d2e3f40516273', name: 'DATABASE_URL' }],
      sharedSecrets: ['DATABASE_URL'],
    },
    {
      app: 'vers-service-user',
      secrets: [{ digest: '237eb2558e3b4f0a9c1d2e3f40516273', name: 'DATABASE_URL' }],
      sharedSecrets: ['DATABASE_URL'],
    },
  ]);

  expect(findings).toStrictEqual([]);
});

test('it names each app under its digest prefix when a shared secret holds more than one value', () => {
  const findings = checkSharedSecrets([
    {
      app: 'vers-service-activity',
      secrets: [{ digest: '237eb2558e3b4f0a9c1d2e3f40516273', name: 'DATABASE_URL' }],
      sharedSecrets: ['DATABASE_URL'],
    },
    {
      app: 'vers-service-avatar',
      secrets: [{ digest: '0a11a3526d4f8b7c6d5e4f3a2b1c0d9e', name: 'DATABASE_URL' }],
      sharedSecrets: ['DATABASE_URL'],
    },
    {
      app: 'vers-service-email',
      secrets: [{ digest: '2dcc65d49f5b1a2b3c4d5e6f70818293', name: 'DATABASE_URL' }],
      sharedSecrets: ['DATABASE_URL'],
    },
    {
      app: 'vers-service-replay',
      secrets: [{ digest: '237eb2558e3b4f0a9c1d2e3f40516273', name: 'DATABASE_URL' }],
      sharedSecrets: ['DATABASE_URL'],
    },
  ]);

  expect(findings).toStrictEqual([
    'shared secret DATABASE_URL holds 3 values across the apps that declare it: 0a11a3526d4f on vers-service-avatar; 237eb2558e3b on vers-service-activity, vers-service-replay; 2dcc65d49f5b on vers-service-email',
  ]);
});

test('it reports an app that declares a shared secret but does not hold it', () => {
  const findings = checkSharedSecrets([
    {
      app: 'vers-service-activity',
      secrets: [{ digest: '237eb2558e3b4f0a9c1d2e3f40516273', name: 'DATABASE_URL' }],
      sharedSecrets: ['DATABASE_URL'],
    },
    {
      app: 'vers-service-user',
      secrets: [{ digest: '9f8e7d6c5b4a39281706f5e4d3c2b1a0', name: 'SERVICE_AUTH_JWKS' }],
      sharedSecrets: ['DATABASE_URL'],
    },
  ]);

  expect(findings).toStrictEqual(['shared secret DATABASE_URL is unset on vers-service-user']);
});

test('it checks each shared secret on its own', () => {
  const findings = checkSharedSecrets([
    {
      app: 'vers-service-activity',
      secrets: [
        { digest: '237eb2558e3b4f0a9c1d2e3f40516273', name: 'DATABASE_URL' },
        { digest: '9f8e7d6c5b4a39281706f5e4d3c2b1a0', name: 'SERVICE_AUTH_JWKS' },
      ],
      sharedSecrets: ['DATABASE_URL', 'SERVICE_AUTH_JWKS'],
    },
    {
      app: 'vers-service-keys',
      secrets: [{ digest: '1122334455667788990011223344aabb', name: 'SERVICE_AUTH_JWKS' }],
      sharedSecrets: ['SERVICE_AUTH_JWKS'],
    },
  ]);

  expect(findings).toStrictEqual([
    'shared secret SERVICE_AUTH_JWKS holds 2 values across the apps that declare it: 112233445566 on vers-service-keys; 9f8e7d6c5b4a on vers-service-activity',
  ]);
});

test('it ignores a secret that differs across apps when no app declares it shared', () => {
  const findings = checkSharedSecrets([
    {
      app: 'vers-service-activity',
      secrets: [
        { digest: '237eb2558e3b4f0a9c1d2e3f40516273', name: 'DATABASE_URL' },
        { digest: 'aaaa000011112222333344445555bbbb', name: 'SENTRY_DSN' },
      ],
      sharedSecrets: ['DATABASE_URL'],
    },
    {
      app: 'vers-service-user',
      secrets: [
        { digest: '237eb2558e3b4f0a9c1d2e3f40516273', name: 'DATABASE_URL' },
        { digest: 'cccc000011112222333344445555dddd', name: 'SENTRY_DSN' },
      ],
      sharedSecrets: ['DATABASE_URL'],
    },
  ]);

  expect(findings).toStrictEqual([]);
});

test('it finds nothing when no app declares a shared secret', () => {
  expect(checkSharedSecrets([])).toStrictEqual([]);
});
