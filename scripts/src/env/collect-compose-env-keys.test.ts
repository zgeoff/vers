import { expect, test } from 'bun:test';
import { parse } from 'yaml';
import { collectComposeEnvKeys } from './collect-compose-env-keys';

test('it collects inline environment keys and env_file references', () => {
  const compose: unknown = parse(
    [
      'services:',
      '  service-activity:',
      '    env_file:',
      '      - services/activity/.env.development',
      '    environment:',
      '      - DATABASE_URL=postgresql://admin:password@postgres:5433/vers',
      '      - REPLAY_SERVICE_URL=http://service-replay:3009',
    ].join('\n'),
  );

  expect(collectComposeEnvKeys(compose, 'service-activity')).toStrictEqual({
    envFileRefs: ['services/activity/.env.development'],
    keys: ['DATABASE_URL', 'REPLAY_SERVICE_URL'],
  });
});

test('it resolves env merged in through YAML anchors and map-form environment', () => {
  const compose: unknown = parse(
    [
      'x-service-base: &service-base',
      '  env_file:',
      '    - stack.env',
      'x-db-env: &db-env',
      '  DATABASE_URL: postgresql://admin:password@postgres:5432/vers',
      'services:',
      '  service-activity:',
      '    environment:',
      '      <<: *db-env',
      '      REPLAY_SERVICE_URL: http://service-replay:3000',
      '    <<: [*service-base]',
    ].join('\n'),
    { merge: true },
  );

  expect(collectComposeEnvKeys(compose, 'service-activity')).toStrictEqual({
    envFileRefs: ['stack.env'],
    keys: ['DATABASE_URL', 'REPLAY_SERVICE_URL'],
  });
});

test('it reports an undefined service as null', () => {
  expect(collectComposeEnvKeys(parse('services: {}'), 'service-missing')).toBeNull();
});
