import { expect, test } from 'bun:test';
import { createDatabaseFromTemplate } from '@vers/service-test-utils/bun';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import * as z from 'zod';
import { createJobQueue } from './create-job-queue';
import type { CreateJobQueueConfig } from './create-job-queue';
import { defineJobs } from './define-jobs';
import type { JobDefs } from './types';

interface SetupTestOptions {
  readonly connectionString?: string;
}

async function setupTest<TDefs extends JobDefs>(
  defs: TDefs,
  handlers: CreateJobQueueConfig<TDefs>['handlers'],
  options: SetupTestOptions = {},
) {
  let connectionString = options.connectionString;

  connectionString ??= await createDatabaseFromTemplate();

  const queue = createJobQueue(defs, { connectionString, handlers });

  await queue.start();

  return { connectionString, queue, [Symbol.asyncDispose]: () => queue.stop() };
}

test('it delivers a sent job to its handler via drain', async () => {
  const defs = defineJobs({ email: { schema: z.object({ to: z.string() }) } });
  const received: Array<{ to: string }> = [];

  await using ctx = await setupTest(defs, {
    email: (payload) => {
      received.push(payload);

      return Promise.resolve();
    },
  });

  await ctx.queue.send('email', { to: 'a@example.com' });

  const result = await ctx.queue.drain();

  expect(result).toStrictEqual({ completed: 1, failed: 0 });
  expect(received).toStrictEqual([{ to: 'a@example.com' }]);
});

test('it enqueues transactionally: a committed send drains and a rolled-back send never appears', async () => {
  const defs = defineJobs({ email: { schema: z.object({ to: z.string() }) } });

  await using ctx = await setupTest(defs, { email: () => Promise.resolve() });

  const pool = new Pool({ connectionString: ctx.connectionString });
  const db = new Kysely<Record<string, never>>({ dialect: new PostgresDialect({ pool }) });

  await db.transaction().execute(async (trx) => {
    await ctx.queue.send('email', { to: 'committed@example.com' }, { trx });
  });

  const committed = await ctx.queue.drain();

  expect(committed).toStrictEqual({ completed: 1, failed: 0 });

  await db
    .transaction()
    .execute(async (trx) => {
      await ctx.queue.send('email', { to: 'rolled-back@example.com' }, { trx });

      throw new Error('rollback');
    })
    .catch((error: unknown) => {
      if (!(error instanceof Error) || error.message !== 'rollback') {
        throw error;
      }
    });

  const rolledBack = await ctx.queue.drain();

  expect(rolledBack).toStrictEqual({ completed: 0, failed: 0 });

  await db.destroy();
});

test('it rejects a send whose payload fails the schema', async () => {
  const defs = defineJobs({ email: { schema: z.object({ to: z.string() }) } });

  await using ctx = await setupTest(defs, { email: () => Promise.resolve() });

  // @ts-expect-error -- exercising the runtime rejection of a payload the type system would reject too
  const sent = ctx.queue.send('email', { to: 42 });

  expect(sent).rejects.toMatchObject({ name: 'ZodError' });
});

test('it retries a failed job after its retry delay', async () => {
  const defs = defineJobs({
    email: { retryDelay: 2, retryLimit: 2, schema: z.object({ to: z.string() }) },
  });

  let attempts = 0;

  await using ctx = await setupTest(defs, {
    email: () => {
      attempts += 1;

      if (attempts === 1) {
        return Promise.reject(new Error('first attempt fails'));
      }

      return Promise.resolve();
    },
  });

  await ctx.queue.send('email', { to: 'a@example.com' });

  const firstDrain = await ctx.queue.drain();

  expect(firstDrain).toStrictEqual({ completed: 0, failed: 1 });

  const beforeDelay = await ctx.queue.drain();

  expect(beforeDelay).toStrictEqual({ completed: 0, failed: 0 });

  await new Promise((resolve) => {
    setTimeout(resolve, 2500);
  });

  const afterDelay = await ctx.queue.drain();

  expect(afterDelay).toStrictEqual({ completed: 1, failed: 0 });
  expect(attempts).toBe(2);
});

test('it dead-letters a job that exhausts its retry limit when the definition opts in', async () => {
  const schema = z.object({ to: z.string() });

  const defs = defineJobs({
    'email.dead': { schema },
    email: { deadLetter: true, retryLimit: 0, schema },
  });

  const deadLettered: Array<{ to: string }> = [];

  await using ctx = await setupTest(defs, {
    'email.dead': (payload) => {
      deadLettered.push(payload);

      return Promise.resolve();
    },
    email: () => Promise.reject(new Error('always fails')),
  });

  await ctx.queue.send('email', { to: 'a@example.com' });

  const drained = await ctx.queue.drain('email');

  expect(drained).toStrictEqual({ completed: 0, failed: 1 });

  const drainedDead = await ctx.queue.drain('email.dead');

  expect(drainedDead).toStrictEqual({ completed: 1, failed: 0 });
  expect(deadLettered).toStrictEqual([{ to: 'a@example.com' }]);
});

test('it fails a job whose stored payload no longer parses', async () => {
  const looseDefs = defineJobs({ email: { retryLimit: 0, schema: z.object({ to: z.string() }) } });

  await using writer = await setupTest(looseDefs, { email: () => Promise.resolve() });

  await writer.queue.send('email', { to: 'a@example.com' });

  const strictDefs = defineJobs({
    email: { retryLimit: 0, schema: z.object({ retries: z.number(), to: z.string() }) },
  });

  const received: Array<unknown> = [];

  await using reader = await setupTest(
    strictDefs,
    {
      email: (payload) => {
        received.push(payload);

        return Promise.resolve();
      },
    },
    { connectionString: writer.connectionString },
  );

  const result = await reader.queue.drain();

  expect(result).toStrictEqual({ completed: 0, failed: 1 });
  expect(received).toBeEmpty();
});
