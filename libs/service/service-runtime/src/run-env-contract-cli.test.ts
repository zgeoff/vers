import { expect, test } from 'bun:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as z from 'zod';
import { runEnvContractCLI } from './run-env-contract-cli';

async function createContractDir(): Promise<URL> {
  const dir = await mkdtemp(join(tmpdir(), 'env-contract-'));

  return pathToFileURL(`${dir}/`);
}

test('it writes the rendered contract beside the service', async () => {
  const dir = await createContractDir();
  const code = await runEnvContractCLI({ args: [], dir, envShape: { DATABASE_URL: z.string() } });

  expect(code).toBe(0);

  const written = await readFile(new URL('env-contract.generated.json', dir), 'utf8');

  expect(JSON.parse(written)).toStrictEqual({
    optional: ['LOG_LEVEL', 'OTEL_EXPORTER_OTLP_ENDPOINT', 'PORT', 'SENTRY_DSN'],
    required: ['DATABASE_URL', 'SERVICE_AUTH_PUBLIC_KEY'],
  });

  expect(written).toEndWith('\n');
});

test('it passes a check when the committed artifact matches the shape', async () => {
  const dir = await createContractDir();

  const envShape = { DATABASE_URL: z.string() };

  await runEnvContractCLI({ args: [], dir, envShape });

  const code = await runEnvContractCLI({ args: ['--check'], dir, envShape });

  expect(code).toBe(0);
});

test('it fails a check when the committed artifact is missing', async () => {
  const dir = await createContractDir();
  const code = await runEnvContractCLI({ args: ['--check'], dir, envShape: {} });

  expect(code).toBe(1);
});

test('it fails a check when the shape gained a key the artifact lacks', async () => {
  const dir = await createContractDir();

  await runEnvContractCLI({ args: [], dir, envShape: {} });

  const code = await runEnvContractCLI({
    args: ['--check'],
    dir,
    envShape: { DATABASE_URL: z.string() },
  });

  expect(code).toBe(1);
});
