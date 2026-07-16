import { withTraceContext } from '@vers/service-utils';
import { createTraceContext } from '@vers/trace';
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
  ) => Promise<string>;
  readonly drain: (name?: Extract<keyof TDefs, string>) => Promise<DrainResult>;
}

/**
 * Every job handler's second argument: per-delivery context pg-boss assigns, independent of the
 * job's own payload.
 */
export interface JobContext {
  readonly jobID: string;
}

/**
 * A failed job's identity plus whether this failure exhausted its retries — `true` means the job
 * dead-letters (or is dropped, without a configured dead-letter queue) instead of retrying.
 */
export interface JobFailureContext {
  readonly jobID: string;
  readonly name: string;
  readonly retriesExhausted: boolean;
}

type OnJobFailed = (error: unknown, context: Readonly<JobFailureContext>) => void;

export interface CreateJobQueueConfig<TDefs extends JobDefs> {
  readonly connectionString: string;
  readonly handlers: {
    readonly [TName in keyof TDefs & string]: (
      payload: Readonly<z.infer<TDefs[TName]['schema']>>,
      context: Readonly<JobContext>,
    ) => Promise<void>;
  };

  /**
   * Called for every pg-boss `error` event (a maintenance or connection fault, not a job
   * failure — job failures surface through the fetch/handle/complete loop's return counts).
   * Defaults to logging via `console.error` so a fault is never silently swallowed.
   */
  readonly onError?: (error: Error) => void;

  /**
   * Called when a fetched job is failed — its handler or completion step threw, or its stored
   * payload no longer parses against the job's schema. The drain result carries only counts, so
   * this callback is the one place a failure's cause is reported. Defaults to logging via
   * `console.error` so the cause is never discarded.
   */
  readonly onJobFailed?: OnJobFailed;
}

/**
 * The internal fetch/handle/complete loop only needs each job's schema and handler by name, so it
 * runs against this erased shape rather than threading the factory config's per-job generic
 * through every helper.
 */
type JobHandlers = Readonly<
  Record<string, (payload: object, context: Readonly<JobContext>) => Promise<void>>
>;

/**
 * Wraps `pg-boss` behind this package's typed API so consumers never import `pg-boss` directly.
 * `config` is a `NoInfer` site: `TDefs` comes from `defs` alone, so a handler that omits its
 * payload parameter can't widen every job's payload type to `object`.
 */
export function createJobQueue<TDefs extends JobDefs>(
  defs: Readonly<TDefs>,
  config: Readonly<CreateJobQueueConfig<NoInfer<TDefs>>>,
): JobQueue<TDefs> {
  const boss = new PgBoss(config.connectionString);

  boss.on('error', (error) => {
    (config.onError ?? printJobQueueError)(error);
  });

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- erases each job's payload type; the fetch/handle/complete loop re-correlates a handler with its schema by their shared runtime key
  const handlers = config.handlers as JobHandlers;
  const onJobFailed = config.onJobFailed ?? printJobError;

  return {
    start: () => startQueues(boss, defs),
    stop: () => boss.stop(),
    send: (name, payload, opts) => sendJob(boss, defs, name, payload, opts),
    drain: (name) => drainJobs(boss, defs, handlers, onJobFailed, name),
  };
}

function printJobQueueError(error: Error): void {
  console.error('[@vers/jobs] pg-boss error', error);
}

function printJobError(error: unknown, context: Readonly<JobFailureContext>): void {
  console.error('[@vers/jobs] job failed', { err: error, ...context });
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
      ...(def.retryBackoff === undefined ? {} : { retryBackoff: def.retryBackoff }),
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
): Promise<string> {
  const def = defs[name];

  invariant(def, `job "${name}" is not defined`);

  const data: object = def.schema.parse(payload);
  const sendOptions = opts?.trx === undefined ? undefined : { db: fromKysely(opts.trx) };

  const jobID = await boss.send(name, data, sendOptions);

  invariant(jobID !== null, `pg-boss accepted the send but returned no job id for "${name}"`);

  return jobID;
}

/**
 * The slice of a fetched job `runJob` needs to complete or fail it and report a failure — narrower
 * than `pg-boss`'s full `JobWithMetadata`, so every field here stays trivially readonly.
 */
interface FetchedJob {
  readonly data: unknown;
  readonly id: string;
  readonly retryCount: number;
  readonly retryLimit: number;
}

/**
 * One-shot fetch/handle/complete loop: batches until a queue is empty, then moves to the next
 * queue.
 */
async function drainJobs(
  boss: PgBoss,
  defs: JobDefs,
  handlers: JobHandlers,
  onJobFailed: OnJobFailed,
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
      const jobs = await boss.fetch<unknown>(queueName, { batchSize: 10, includeMetadata: true });

      if (jobs.length === 0) {
        break;
      }

      for (const job of jobs) {
        const outcome = await runJob(boss, queueName, def, handler, onJobFailed, job);

        if (outcome === 'completed') {
          completed += 1;
        } else {
          failed += 1;
        }
      }
    }
  }

  return { completed, failed };
}

type JobOutcome = 'completed' | 'failed';

/**
 * Runs one job's parse/handle/complete/fail cycle inside its own fresh trace context, so a report
 * `onJobFailed` makes and the log line around it correlate by trace id. A payload that no longer
 * parses against its job's schema is failed without ever reaching the handler, since pg-boss
 * stores payloads as untyped jsonb.
 */
function runJob(
  boss: PgBoss,
  queueName: string,
  def: Readonly<JobDef>,
  handler: JobHandlers[string],
  onJobFailed: OnJobFailed,
  job: Readonly<FetchedJob>,
): Promise<JobOutcome> {
  return withTraceContext(createTraceContext(), async () => {
    const parsed = def.schema.safeParse(job.data);

    if (!parsed.success) {
      // reported before the fail round-trip so a rejecting `fail` can never mask the cause
      onJobFailed(
        new Error(`job "${queueName}" payload failed schema validation`, { cause: parsed.error }),
        {
          jobID: job.id,
          name: queueName,
          retriesExhausted: isRetriesExhausted(job),
        },
      );

      await boss.fail(queueName, job.id);

      return 'failed';
    }

    try {
      await handler(parsed.data, { jobID: job.id });

      await boss.complete(queueName, job.id);

      return 'completed';
    } catch (error) {
      // reported before the fail round-trip so a rejecting `fail` can never mask the cause
      onJobFailed(error, {
        jobID: job.id,
        name: queueName,
        retriesExhausted: isRetriesExhausted(job),
      });

      await boss.fail(queueName, job.id);

      return 'failed';
    }
  });
}

/**
 * A fetched job's `retryCount` already reflects this attempt (pg-boss increments it on refetch,
 * before the handler ever runs), so comparing it against `retryLimit` here mirrors exactly the
 * condition pg-boss itself uses to decide retry vs. terminal when this attempt is failed.
 */
function isRetriesExhausted(job: Readonly<Pick<FetchedJob, 'retryCount' | 'retryLimit'>>): boolean {
  return job.retryCount >= job.retryLimit;
}
