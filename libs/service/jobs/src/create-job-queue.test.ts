import { expect, onTestFinished, test } from 'bun:test';
import { createDatabaseFromTemplate } from '@vers/service-test-utils/bun';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import * as z from 'zod';
import { createJobQueue } from './create-job-queue';
import { defineJobs } from './define-jobs';

test('it delivers a sent job to its handler via drain', async () => {
  const connectionString = await createDatabaseFromTemplate();

  const defs = defineJobs({ email: { schema: z.object({ to: z.string() }) } });
  const received: Array<{ to: string }> = [];

  const queue = createJobQueue(defs, {
    connectionString,
    handlers: {
      email: (payload) => {
        received.push(payload);

        return Promise.resolve();
      },
    },
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  await queue.send('email', { to: 'a@example.com' });

  const result = await queue.drain();

  expect(result).toStrictEqual({ completed: 1, failed: 0 });
  expect(received).toStrictEqual([{ to: 'a@example.com' }]);
});

test('it returns the job id drain hands the handler', async () => {
  const connectionString = await createDatabaseFromTemplate();

  const defs = defineJobs({ email: { schema: z.object({ to: z.string() }) } });
  const receivedJobIDs: Array<string> = [];

  const queue = createJobQueue(defs, {
    connectionString,
    handlers: {
      email: (_payload, context) => {
        receivedJobIDs.push(context.jobID);

        return Promise.resolve();
      },
    },
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  const jobID = await queue.send('email', { to: 'a@example.com' });

  await queue.drain();

  expect(receivedJobIDs).toStrictEqual([jobID]);
});

test('it enqueues transactionally: a committed send drains and a rolled-back send never appears', async () => {
  const connectionString = await createDatabaseFromTemplate();

  const defs = defineJobs({ email: { schema: z.object({ to: z.string() }) } });

  const queue = createJobQueue(defs, {
    connectionString,
    handlers: { email: () => Promise.resolve() },
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  const pool = new Pool({ connectionString });
  const db = new Kysely<Record<string, never>>({ dialect: new PostgresDialect({ pool }) });

  onTestFinished(() => db.destroy());

  await db.transaction().execute(async (trx) => {
    await queue.send('email', { to: 'committed@example.com' }, { trx });
  });

  const committed = await queue.drain();

  expect(committed).toStrictEqual({ completed: 1, failed: 0 });

  await db
    .transaction()
    .execute(async (trx) => {
      await queue.send('email', { to: 'rolled-back@example.com' }, { trx });

      throw new Error('rollback');
    })
    .catch((error: unknown) => {
      if (!(error instanceof Error) || error.message !== 'rollback') {
        throw error;
      }
    });

  const rolledBack = await queue.drain();

  expect(rolledBack).toStrictEqual({ completed: 0, failed: 0 });
});

test('it rejects a send whose payload fails the schema', async () => {
  const connectionString = await createDatabaseFromTemplate();

  const defs = defineJobs({ email: { schema: z.object({ to: z.string() }) } });

  const queue = createJobQueue(defs, {
    connectionString,
    handlers: { email: () => Promise.resolve() },
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  // @ts-expect-error -- exercising the runtime rejection of a payload the type system would reject too
  const sent = queue.send('email', { to: 42 });

  expect(sent).rejects.toMatchObject({ name: 'ZodError' });
});

test('it retries a failed job after its retry delay', async () => {
  const connectionString = await createDatabaseFromTemplate();

  const defs = defineJobs({
    email: { retryDelay: 2, retryLimit: 2, schema: z.object({ to: z.string() }) },
  });

  let attempts = 0;

  const queue = createJobQueue(defs, {
    connectionString,
    handlers: {
      email: () => {
        attempts += 1;

        if (attempts === 1) {
          return Promise.reject(new Error('first attempt fails'));
        }

        return Promise.resolve();
      },
    },
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  await queue.send('email', { to: 'a@example.com' });

  const firstDrain = await queue.drain();

  expect(firstDrain).toStrictEqual({ completed: 0, failed: 1 });

  const beforeDelay = await queue.drain();

  expect(beforeDelay).toStrictEqual({ completed: 0, failed: 0 });

  await new Promise((resolve) => {
    setTimeout(resolve, 2500);
  });

  const afterDelay = await queue.drain();

  expect(afterDelay).toStrictEqual({ completed: 1, failed: 0 });
  expect(attempts).toBe(2);
});

test('it retries a failed job on an exponential backoff schedule when the definition opts in', async () => {
  const connectionString = await createDatabaseFromTemplate();

  const defs = defineJobs({
    email: {
      retryBackoff: true,
      retryDelay: 1,
      retryLimit: 2,
      schema: z.object({ to: z.string() }),
    },
  });

  let attempts = 0;

  const queue = createJobQueue(defs, {
    connectionString,
    handlers: {
      email: () => {
        attempts += 1;

        if (attempts === 1) {
          return Promise.reject(new Error('first attempt fails'));
        }

        return Promise.resolve();
      },
    },
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  await queue.send('email', { to: 'a@example.com' });

  const firstDrain = await queue.drain();

  expect(firstDrain).toStrictEqual({ completed: 0, failed: 1 });

  await new Promise((resolve) => {
    setTimeout(resolve, 3000);
  });

  const afterBackoff = await queue.drain();

  expect(afterBackoff).toStrictEqual({ completed: 1, failed: 0 });
  expect(attempts).toBe(2);
});

test('it dead-letters a job that exhausts its retry limit when the definition opts in', async () => {
  const connectionString = await createDatabaseFromTemplate();

  const schema = z.object({ to: z.string() });

  const defs = defineJobs({
    'email.dead': { schema },
    email: { deadLetter: true, retryLimit: 0, schema },
  });

  const deadLettered: Array<{ to: string }> = [];

  const queue = createJobQueue(defs, {
    connectionString,
    handlers: {
      'email.dead': (payload) => {
        deadLettered.push(payload);

        return Promise.resolve();
      },
      email: () => Promise.reject(new Error('always fails')),
    },
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  await queue.send('email', { to: 'a@example.com' });

  const drained = await queue.drain('email');

  expect(drained).toStrictEqual({ completed: 0, failed: 1 });

  const drainedDead = await queue.drain('email.dead');

  expect(drainedDead).toStrictEqual({ completed: 1, failed: 0 });
  expect(deadLettered).toStrictEqual([{ to: 'a@example.com' }]);
});

test('it fails a job whose stored payload no longer parses', async () => {
  const connectionString = await createDatabaseFromTemplate();

  const looseDefs = defineJobs({ email: { retryLimit: 0, schema: z.object({ to: z.string() }) } });

  const writer = createJobQueue(looseDefs, {
    connectionString,
    handlers: { email: () => Promise.resolve() },
  });

  await writer.start();

  onTestFinished(() => writer.stop());

  await writer.send('email', { to: 'a@example.com' });

  const strictDefs = defineJobs({
    email: { retryLimit: 0, schema: z.object({ retries: z.number(), to: z.string() }) },
  });

  const received: Array<unknown> = [];

  const reader = createJobQueue(strictDefs, {
    connectionString,
    handlers: {
      email: (payload) => {
        received.push(payload);

        return Promise.resolve();
      },
    },
  });

  await reader.start();

  onTestFinished(() => reader.stop());

  const result = await reader.drain();

  expect(result).toStrictEqual({ completed: 0, failed: 1 });
  expect(received).toBeEmpty();
});
