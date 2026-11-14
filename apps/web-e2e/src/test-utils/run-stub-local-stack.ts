import { join } from 'node:path';
import { z } from 'zod';
import { readFreePort } from '../verify/local/read-free-port';
import { runLocalStack } from '../verify/local/run-local-stack';

// Runs the real runLocalStack with stand-in parts for a test: no database setup, and
// STUB_STACK_PARTS.heldChildren children from run-stub-held-server.ts in place of the services and
// the web server. Postgres and the web build go through the `docker` and `bunx` on PATH.

const partsSchema = z.object({
  readyDeadlineMs: z.number().int(),
  stopGraceMs: z.number().int(),
  heldChildren: z.number().int(),
});

const parts = partsSchema.parse(JSON.parse(process.env['STUB_STACK_PARTS'] ?? '{}'));
const pidDirectory = process.env['STUB_PID_DIRECTORY'] ?? '/tmp';

const exitCode = await runLocalStack({
  readyDeadlineMs: parts.readyDeadlineMs,
  stopGraceMs: parts.stopGraceMs,
  setupDatabase: () => Promise.resolve(),
  readChildren: () =>
    Promise.resolve(
      Array.from({ length: parts.heldChildren }, (_, index) => {
        const port = readFreePort();

        return {
          name: `held-${index}`,
          command: ['bun', join(import.meta.dir, 'run-stub-held-server.ts')],
          env: { STUB_PORT: String(port), STUB_PID_DIRECTORY: pidDirectory },
          healthURL: `http://127.0.0.1:${port}/health`,
        };
      }),
    ),
});

process.exit(exitCode);
