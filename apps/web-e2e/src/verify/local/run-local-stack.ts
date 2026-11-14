import { join } from 'node:path';
import type { Subprocess } from 'bun';
import {
  buildServiceEnv,
  buildWebEnv,
  localEngineHash,
  stackServiceNames,
} from './build-stack-env';
import { createPostgresContainer } from './create-postgres-container';
import { readFreePort } from './read-free-port';
import { runDatabaseSetup } from './run-database-setup';
import type { StackPorts } from './types';

const repoRoot = join(import.meta.dir, '..', '..', '..', '..', '..');
const e2eRoot = join(repoRoot, 'apps', 'web-e2e');
const webRoot = join(repoRoot, 'apps', 'web');

// The `local` target's app: Postgres in a throwaway container, this tree's eight services, a
// Resend stub and an umami stub as child processes, and the web app's production build. It prints
// one ready line, runs until SIGTERM or SIGINT, then removes everything it started.
export async function runLocalStack(): Promise<number> {
  const stopController = new AbortController();

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      stopController.abort();
    });
  }

  const cleanup = new AsyncDisposableStack();

  let exitCode = 0;

  try {
    await runParts(cleanup, stopController.signal);
  } catch (error) {
    process.stderr.write(`verify local: the start failed: ${String(error)}\n`);

    exitCode = 1;
  }

  try {
    await cleanup.disposeAsync();
  } catch (error) {
    process.stderr.write(`verify local: a part failed to stop: ${String(error)}\n`);

    exitCode = 1;
  }

  return exitCode;
}

async function runParts(cleanup: AsyncDisposableStack, signal: AbortSignal): Promise<void> {
  const startedAt = performance.now();
  const ports = readPorts();

  // A failed part stops the other, and both settle before the failure throws. The container then
  // registers its removal before the cleanup runs, even when the build fails first.
  const partsController = new AbortController();

  const partsSignal = AbortSignal.any([signal, partsController.signal]);

  const [postgres, build] = await Promise.allSettled([
    abortOnFailure(createPostgresContainer(cleanup, partsSignal), partsController),
    abortOnFailure(runWebBuild(partsSignal), partsController),
  ]);

  if (postgres.status === 'rejected') {
    throw postgres.reason;
  }

  if (build.status === 'rejected') {
    throw build.reason;
  }

  if (signal.aborted) {
    return;
  }

  await runDatabaseSetup(postgres.value.databaseURL);

  const stackEnvText = await Bun.file(join(e2eRoot, 'stack.env')).text();

  startChild(cleanup, {
    name: 'resend-stub',
    command: ['bun', join(e2eRoot, 'src', 'serve-resend-stub.ts')],
    env: { RESEND_STUB_PORT: String(ports.resend) },
  });

  startChild(cleanup, {
    name: 'umami-stub',
    command: ['bun', join(e2eRoot, 'src', 'serve-umami-stub.ts')],
    env: { UMAMI_STUB_PORT: String(ports.umami) },
  });

  for (const service of stackServiceNames) {
    const serviceRoot = join(repoRoot, 'services', service);

    const developmentEnvText = await Bun.file(join(serviceRoot, '.env.development')).text();

    const env = buildServiceEnv({
      service,
      ports,
      databaseURL: postgres.value.databaseURL,
      developmentEnvText,
      stackEnvText,
    });

    startChild(cleanup, {
      name: service,
      command: ['bun', join(serviceRoot, 'src', 'serve.ts')],
      env,
    });
  }

  startChild(cleanup, {
    name: 'web',
    command: ['node', join(webRoot, 'server.mjs')],
    env: buildWebEnv({ ports, stackEnvText }),
    cwd: webRoot,
  });

  const healthURLs = [
    `http://127.0.0.1:${ports.resend}/health`,
    `http://127.0.0.1:${ports.umami}/health`,
    ...stackServiceNames.map((service) => `http://127.0.0.1:${ports.services[service]}/health`),
    `http://127.0.0.1:${ports.web}/health`,
  ];

  await Promise.all(healthURLs.map((url) => waitForHealthy(url, signal)));

  if (signal.aborted) {
    return;
  }

  const serviceEndpoints = stackServiceNames.map((service) => [
    service,
    `http://127.0.0.1:${ports.services[service]}`,
  ]);

  const startMs = Math.round(performance.now() - startedAt);

  const ready = JSON.stringify({
    event: 'ready',
    web: `http://127.0.0.1:${ports.web}`,
    resend: `http://127.0.0.1:${ports.resend}`,
    db: postgres.value.endpoint,
    container: postgres.value.name,
    ...Object.fromEntries(serviceEndpoints),
    startMs: String(startMs),
  });

  process.stdout.write(`${ready}\n`);

  await waitForAbort(signal);
}

function readPorts(): StackPorts {
  return {
    web: readFreePort(),
    resend: readFreePort(),
    umami: readFreePort(),
    services: {
      activity: readFreePort(),
      avatar: readFreePort(),
      email: readFreePort(),
      keys: readFreePort(),
      replay: readFreePort(),
      session: readFreePort(),
      user: readFreePort(),
      verification: readFreePort(),
    },
  };
}

// turbo restores the build from its cache when no input changed, and the engine hash is an input
async function abortOnFailure<T>(part: Promise<T>, controller: AbortController): Promise<T> {
  try {
    return await part;
  } catch (error) {
    controller.abort();
    throw error;
  }
}

async function runWebBuild(signal: AbortSignal): Promise<void> {
  const build = Bun.spawn(
    ['bunx', 'turbo', 'run', 'build', '--filter=@vers/web', '--output-logs=errors-only'],
    {
      cwd: repoRoot,
      env: { ...process.env, VITE_SIM_ENGINE_HASH: localEngineHash },
      stdout: 'ignore',
      stderr: 'inherit',
      signal,
    },
  );

  const exitCode = await build.exited;

  if (exitCode !== 0 && !signal.aborted) {
    throw new Error(`the web build exited with code ${exitCode}`);
  }
}

interface ChildSpec {
  readonly name: string;
  readonly command: ReadonlyArray<string>;
  readonly env: Readonly<Record<string, string>>;
  readonly cwd?: string;
}

function startChild(cleanup: AsyncDisposableStack, spec: ChildSpec): void {
  const child = Bun.spawn([...spec.command], {
    cwd: spec.cwd ?? repoRoot,

    // production runs every process in UTC, and a `timestamp without time zone` column reads back
    // shifted in any other zone
    env: {
      PATH: process.env['PATH'] ?? '',
      HOME: process.env['HOME'] ?? '',
      TZ: 'UTC',
      ...spec.env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  void copyOutput(spec.name, child.stdout);
  void copyOutput(spec.name, child.stderr);
  cleanup.defer(() => stopChild(child));
}

// every child's output goes to this process's stderr, which the run keeps as the app's log
async function copyOutput(name: string, output: ReadableStream<Uint8Array>): Promise<void> {
  const decoder = new TextDecoder();

  for await (const chunk of output) {
    for (const line of decoder.decode(chunk, { stream: true }).split('\n')) {
      if (line !== '') {
        process.stderr.write(`[${name}] ${line}\n`);
      }
    }
  }
}

const stopGraceMs = 5000;

async function stopChild(child: Subprocess): Promise<void> {
  child.kill('SIGTERM');

  const forceKill = setTimeout(() => {
    child.kill('SIGKILL');
  }, stopGraceMs);

  await child.exited;

  clearTimeout(forceKill);
}

const healthPollMs = 250;

async function waitForHealthy(url: string, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    const healthy = await fetch(url, { signal }).then(
      (response) => response.ok,
      () => false,
    );

    if (healthy) {
      return;
    }

    await Bun.sleep(healthPollMs);
  }
}

function waitForAbort(signal: AbortSignal): Promise<void> {
  const aborted = Promise.withResolvers<void>();

  if (signal.aborted) {
    aborted.resolve();
  }

  signal.addEventListener('abort', () => {
    aborted.resolve();
  });

  return aborted.promise;
}

if (import.meta.main) {
  const exitCode = await runLocalStack();

  process.exit(exitCode);
}
