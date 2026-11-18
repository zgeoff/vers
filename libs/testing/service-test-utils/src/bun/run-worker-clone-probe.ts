import { join } from 'node:path';
import postgres from 'postgres';
import { z } from 'zod';
import { resolveTestDBTarget } from './resolve-test-db-target';

const PACKAGE_DIR = join(import.meta.dir, '..', '..');

const FIXTURES = [
  './src/bun/fixtures/transaction-worker-clone.fixture.ts',
  './src/bun/fixtures/schema-worker-clone.fixture.ts',
];

export interface WorkerCloneProbe {
  readonly acquired: ReadonlyArray<string>;
  readonly exitCode: number;
  readonly output: string;
  readonly remaining: ReadonlyArray<string>;
}

// Runs the fixtures with `bun test` in a child process, so the child's process-exit cleanup is the
// one under test. It reports the databases the fixtures acquired and which of them outlive the run.
export async function runWorkerCloneProbe(flags: ReadonlyArray<string>): Promise<WorkerCloneProbe> {
  const child = Bun.spawn(['bun', 'test', ...flags, ...FIXTURES], {
    cwd: PACKAGE_DIR,
    stderr: 'pipe',
    stdout: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    child.stdout.text(),
    child.stderr.text(),
    child.exited,
  ]);

  const output = `${stdout}\n${stderr}`;

  const acquired = [...output.matchAll(/ACQUIRED_DATABASE:(?<name>\S+)/gu)].flatMap((match) =>
    match.groups?.['name'] === undefined ? [] : [match.groups['name']],
  );

  return { acquired, exitCode, output, remaining: await readExistingDatabases(acquired) };
}

async function readExistingDatabases(names: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
  const admin = postgres(`${resolveTestDBTarget().baseURI}/postgres`, { max: 1 });

  try {
    const rows = await admin`SELECT datname FROM pg_database WHERE datname = ANY(${[...names]})`;

    return z
      .array(z.object({ datname: z.string() }))
      .parse(rows)
      .map((row) => row.datname);
  } finally {
    await admin.end();
  }
}
