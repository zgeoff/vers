import { expect, test } from 'bun:test';
import { updateEnv } from '@vers/test-utils/bun';
import { buildTelemetryResource } from './build-telemetry-resource';

test('it tags the service name and the deployment environment from NODE_ENV', () => {
  updateEnv('FLY_IMAGE_REF', undefined);

  const resource = buildTelemetryResource({ serviceName: 'test-service' });

  expect(resource.attributes).toContainEntries([
    ['service.name', 'test-service'],
    ['deployment.environment.name', 'test'],
  ]);

  expect(resource.attributes).not.toContainKey('service.version');
});

test('it tags the service version from FLY_IMAGE_REF when set', () => {
  updateEnv('FLY_IMAGE_REF', 'registry.fly.io/vers-service:deployment-01ABC');

  const resource = buildTelemetryResource({ serviceName: 'test-service' });

  expect(resource.attributes).toContainEntry([
    'service.version',
    'registry.fly.io/vers-service:deployment-01ABC',
  ]);
});
