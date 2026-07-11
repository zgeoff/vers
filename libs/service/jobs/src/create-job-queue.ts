import { PgBoss, fromKysely } from 'pg-boss';
import type { KyselyTransactionLike } from 'pg-boss';
import invariant from 'tiny-invariant';
import type * as z from 'zod';
import type { JobDef, JobDefs } from './types';

/**
 * `trx`, when present, routes the enqueue through `pg-boss`'s Kysely adapter so the send commits
 * or rolls back with the caller's own transaction instead of pg-boss's separate connection pool.
 */
export interface SendJobOptions {
  readonly trx?: KyselyTransactionLike;
}

export interface DrainResult {
  readonly completed: number;
  readonly failed: number;
}

export interface JobQueue<TDefs extends JobDefs> {
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly send: <TName extends keyof TDefs & string>(
    name: TName,
    payload: Readonly<z.infer<TDefs[TName]['schema']>>,
    opts?: Readonly<SendJobOptions>,
  ) => Promise<void>;
  readonly drain: (name?: Extract<keyof TDefs, string>) => Promise<DrainResult>;
}

export interface CreateJobQueueConfig<TDefs extends JobDefs> {
  readonly connectionString: string;
  readonly handlers: {
    readonly [TName in keyof TDefs & string]: (
      payload: Readonly<z.infer<TDefs[TName]['schema']>>,
    ) => Promise<void>;
  };

  /**
   * Called for every pg-boss `error` event (a maintenance or connection fault, not a job
   * failure — job failures surface through the fetch/handle/complete loop's return counts).
   * Defaults to logging via `console.error` so a fault is never silently swallowed.
   */
  readonly onError?: (error: Error) => void;
}

/**
 * The internal fetch/handle/complete loop only needs each job's schema and handler by name, so it
 * runs against this erased shape rather than threading the factory config's per-job generic
 * through every helper.
 */
type JobHandlers = Readonly<Record<string, (payload: object) => Promise<void>>>;

/**
 * Wraps `pg-boss` behind this package's typed API so consumers never import `pg-boss` directly.
 */
export function createJobQueue<TDefs extends JobDefs>(
  defs: Readonly<TDefs>,
  config: Readonly<CreateJobQueueConfig<TDefs>>,
): JobQueue<TDefs> {
  const boss = new PgBoss(config.connectionString);

  boss.on('error', (error) => {
    (config.onError ?? printJobQueueError)(error);
  });

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- erases each job's payload type; the fetch/handle/complete loop re-correlates a handler with its schema by their shared runtime key
  const handlers = config.handlers as JobHandlers;

  return {
    start: () => startQueues(boss, defs),
    stop: () => boss.stop(),
    send: (name, payload, opts) => sendJob(boss, defs, name, payload, opts),
    drain: (name) => drainJobs(boss, defs, handlers, name),
  };
}

function printJobQueueError(error: Error): void {
  console.error('[@vers/jobs] pg-boss error', error);
}

const DEAD_LETTER_SUFFIX = '.dead';

/**
 * Idempotent: `pg-boss`'s `createQueue` upserts, so calling `start` again against an already
 * migrated database is safe. A dead-letter queue is created before the queue that references it,
 * since pg-boss enforces the reference with a foreign key.
 */
async function startQueues(boss: PgBoss, defs: JobDefs): Promise<void> {
  await boss.start();

  for (const [name, def] of Object.entries(defs)) {
    const deadLetterName = def.deadLetter === true ? `${name}${DEAD_LETTER_SUFFIX}` : undefined;

    if (deadLetterName !== undefined) {
      await boss.createQueue(deadLetterName);
    }

    await boss.createQueue(name, {
      ...(deadLetterName === undefined ? {} : { deadLetter: deadLetterName }),
      ...(def.retryDelay === undefined ? {} : { retryDelay: def.retryDelay }),
      ...(def.retryLimit === undefined ? {} : { retryLimit: def.retryLimit }),
    });
  }
}

async function sendJob(
  boss: PgBoss,
  defs: JobDefs,
  name: string,
  payload: object,
  opts: Readonly<SendJobOptions> | undefined,
): Promise<void> {
  const def = defs[name];

  invariant(def, `job "${name}" is not defined`);

  const data: object = def.schema.parse(payload);
  const sendOptions = opts?.trx === undefined ? undefined : { db: fromKysely(opts.trx) };

  await boss.send(name, data, sendOptions);
}

/**
 * One-shot fetch/handle/complete loop: batches until a queue is empty, then moves to the next
 * queue. A payload that no longer parses against its job's schema is failed without ever reaching
 * the handler, since pg-boss stores payloads as untyped jsonb.
 */
async function drainJobs(
  boss: PgBoss,
  defs: JobDefs,
  handlers: JobHandlers,
  name: string | undefined,
): Promise<DrainResult> {
  const names = name === undefined ? Object.keys(defs) : [name];
  let completed = 0;
  let failed = 0;

  for (const queueName of names) {
    const def: JobDef | undefined = defs[queueName];

    invariant(def, `job "${queueName}" is not defined`);

    const handler = handlers[queueName];

    invariant(handler, `job "${queueName}" has no handler`);

    for (;;) {
      const jobs = await boss.fetch<unknown>(queueName, { batchSize: 10 });

      if (jobs.length === 0) {
        break;
      }

      for (const job of jobs) {
        const parsed = def.schema.safeParse(job.data);

        if (!parsed.success) {
          await boss.fail(queueName, job.id);

          failed += 1;
          continue;
        }

        try {
          await handler(parsed.data);

          await boss.complete(queueName, job.id);

          completed += 1;
        } catch {
          await boss.fail(queueName, job.id);

          failed += 1;
        }
      }
    }
  }

  return { completed, failed };
}
