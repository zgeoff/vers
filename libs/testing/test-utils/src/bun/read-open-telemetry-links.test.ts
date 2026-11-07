import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readOpenTelemetryLinks } from './read-open-telemetry-links';

async function setupTest() {
  const projectDir = await mkdtemp(join(tmpdir(), 'read-open-telemetry-links-'));

  onTestFinished(() => rm(projectDir, { force: true, recursive: true }));

  return { projectDir };
}

test('it lists the OpenTelemetry package that a same-scope dependency declares, at the version nearest that dependency', async () => {
  const ctx = await setupTest();

  const modulesDir = join(ctx.projectDir, 'node_modules');

  await Bun.write(
    join(modulesDir, '@acme/sdk/package.json'),
    JSON.stringify({
      dependencies: { '@acme/tracing': '1.0.0' },
      name: '@acme/sdk',
      version: '1.0.0',
    }),
  );

  await Bun.write(
    join(modulesDir, '@acme/tracing/package.json'),
    JSON.stringify({
      name: '@acme/tracing',
      peerDependencies: { '@opentelemetry/core': '^2.1.0' },
      version: '1.0.0',
    }),
  );

  await Bun.write(
    join(modulesDir, '@acme/tracing/node_modules/@opentelemetry/core/package.json'),
    JSON.stringify({ name: '@opentelemetry/core', version: '3.0.0' }),
  );

  await Bun.write(
    join(modulesDir, '@opentelemetry/core/package.json'),
    JSON.stringify({ name: '@opentelemetry/core', version: '2.12.0' }),
  );

  expect(readOpenTelemetryLinks('@acme/sdk', ctx.projectDir)).toStrictEqual([
    { name: '@opentelemetry/core', owner: '@acme/tracing', range: '^2.1.0', version: '3.0.0' },
  ]);
});

test('it leaves out an optional OpenTelemetry peer that the install does not link', async () => {
  const ctx = await setupTest();

  await Bun.write(
    join(ctx.projectDir, 'node_modules/@acme/sdk/package.json'),
    JSON.stringify({
      name: '@acme/sdk',
      peerDependencies: { '@opentelemetry/exporter-trace-otlp-http': '<0.300.0' },
      peerDependenciesMeta: { '@opentelemetry/exporter-trace-otlp-http': { optional: true } },
      version: '1.0.0',
    }),
  );

  expect(readOpenTelemetryLinks('@acme/sdk', ctx.projectDir)).toStrictEqual([]);
});

test('it throws when the install does not link a required OpenTelemetry peer', async () => {
  const ctx = await setupTest();

  await Bun.write(
    join(ctx.projectDir, 'node_modules/@acme/sdk/package.json'),
    JSON.stringify({
      name: '@acme/sdk',
      peerDependencies: { '@opentelemetry/api': '^1.9.0' },
      version: '1.0.0',
    }),
  );

  expect(() => readOpenTelemetryLinks('@acme/sdk', ctx.projectDir)).toThrowWithMessage(
    Error,
    /@acme\/sdk declares @opentelemetry\/api, which the install does not link/u,
  );
});

test('it leaves out the OpenTelemetry packages of a dependency outside the package scope', async () => {
  const ctx = await setupTest();

  const modulesDir = join(ctx.projectDir, 'node_modules');

  await Bun.write(
    join(modulesDir, '@acme/sdk/package.json'),
    JSON.stringify({
      dependencies: { 'stack-parser': '1.0.0' },
      name: '@acme/sdk',
      version: '1.0.0',
    }),
  );

  await Bun.write(
    join(modulesDir, 'stack-parser/package.json'),
    JSON.stringify({
      dependencies: { '@opentelemetry/api': '^1.9.0' },
      name: 'stack-parser',
      version: '1.0.0',
    }),
  );

  await Bun.write(
    join(modulesDir, '@opentelemetry/api/package.json'),
    JSON.stringify({ name: '@opentelemetry/api', version: '1.9.1' }),
  );

  expect(readOpenTelemetryLinks('@acme/sdk', ctx.projectDir)).toStrictEqual([]);
});

test('it throws when the package is not installed', async () => {
  const ctx = await setupTest();

  expect(() => readOpenTelemetryLinks('@acme/sdk', ctx.projectDir)).toThrowWithMessage(
    Error,
    /@acme\/sdk is not installed/u,
  );
});
