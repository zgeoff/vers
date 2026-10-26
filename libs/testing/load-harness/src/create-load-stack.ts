import path from 'node:path';
import { parseEnv } from 'node:util';
import { applyMigrations, createDB } from '@vers/db';
import { parseServicePrivateKey } from '@vers/service-auth';
import { $ } from 'bun';
import invariant from 'tiny-invariant';
import { parseContainerCPULimits } from './parse-container-cpu-limits';
import { parseContainerExits } from './parse-container-exits';
import type { LoadEngineVersions, LoadStack } from './types';
import { writeLoadRegistry } from './write-load-registry';

const STACK_ENV_FILE = path.resolve(import.meta.dirname, '../../../../apps/web-e2e/stack.env');
const PROJECT_NAME = 'vers-load';
const DATABASE_URL = 'postgresql://admin:password@127.0.0.1:5733/vers';
const SESSION_SECRET = 'load-session-secret-32-characters';

// two of the compute units the Neon endpoint autoscales between
export const LOAD_POSTGRES_CPUS = 2;

interface CreateLoadStackOptions {
  readonly imageRefs: Readonly<Record<string, string>>;
  readonly serviceCPUs: number;
  readonly versions: LoadEngineVersions;
}

type ComposeEnv = Readonly<Record<string, string | undefined>>;

// one fresh stack per scenario: postgres first and migrated before any service boots, then the
// registry rows the services read at their first request
export async function createLoadStack(
  options: Readonly<CreateLoadStackOptions>,
): Promise<LoadStack> {
  const env: ComposeEnv = {
    ...process.env,
    ...options.imageRefs,
    LOAD_POSTGRES_CPUS: String(LOAD_POSTGRES_CPUS),
    LOAD_SERVICE_CPUS: String(options.serviceCPUs),
    LOAD_SESSION_SECRET: SESSION_SECRET,
  };

  await runCompose(env, ['down', '-v', '--remove-orphans']);

  const db = createDB({ databaseURL: DATABASE_URL });

  try {
    await runCompose(env, ['up', '-d', '--wait', 'postgres']);
    await applyMigrations({ databaseURL: DATABASE_URL });
    await writeLoadRegistry(db, options.versions);
    await runCompose(env, ['up', '-d', '--wait']);
  } catch (error) {
    // a stack that failed to boot leaves its containers behind unless this run removes them
    await db.destroy();

    await runCompose(env, ['down', '-v', '--remove-orphans']);

    throw error;
  }

  const stackEnvText = await Bun.file(STACK_ENV_FILE).text();

  const privateKeyPEM = parseEnv(stackEnvText)['SERVICE_AUTH_PRIVATE_KEY'];

  invariant(privateKeyPEM !== undefined, 'the stack env carries the shared service key');

  return {
    appURL: 'http://127.0.0.1:3400',
    containerPrefix: `${PROJECT_NAME}-`,
    db,
    privateKey: await parseServicePrivateKey(privateKeyPEM),
    readContainerStats: () => $`docker stats --no-stream --format ${'{{json .}}'}`.quiet().text(),
    readCPULimits: async () => {
      const inspection = await readContainerInspection(env);

      return parseContainerCPULimits(inspection);
    },
    readExits: async (startedAt) => {
      const inspection = await readContainerInspection(env);

      return parseContainerExits(inspection, startedAt);
    },
    readLogs: (service, since) =>
      runCompose(env, ['logs', '--no-color', '--since', since.toISOString(), service]),
    remove: async () => {
      await db.destroy();

      await runCompose(env, ['down', '-v', '--remove-orphans']);
    },
    sessionSecret: SESSION_SECRET,
    sessionServiceURL: 'http://127.0.0.1:3401',
    startService: async (service) => {
      await runCompose(env, ['up', '-d', '--wait', '--no-deps', service]);
    },
    stopService: async (service) => {
      await runCompose(env, ['stop', service]);
    },
    versions: options.versions,
  };
}

const COMPOSE_FILE = path.resolve(import.meta.dirname, '../docker-compose.load.yml');

async function runCompose(env: ComposeEnv, args: ReadonlyArray<string>): Promise<string> {
  const result = await $`docker compose -p ${PROJECT_NAME} -f ${COMPOSE_FILE} ${args}`
    .env(env)
    .quiet()
    .nothrow();

  if (result.exitCode !== 0) {
    throw new Error(`docker compose ${args.join(' ')} failed: ${result.stderr.toString().trim()}`);
  }

  return result.stdout.toString();
}

async function readContainerInspection(env: ComposeEnv): Promise<string> {
  const ids = await runCompose(env, ['ps', '--all', '--quiet']);

  return $`docker inspect ${ids.split('\n').filter((id) => id !== '')}`.quiet().text();
}
