import { withRootSpan } from '@vers/service-utils';
import { PgBoss, fromKysely } from 'pg-boss';
import type { KyselyTransactionLike } from 'pg-boss';
import invariant from 'tiny-invariant';
import type * as z from 'zod';
import type { JobDef, JobDefs } from './types';

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

export interface JobContext {
  readonly jobID: string;
}

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

  readonly onError?: (error: Error) => void;

  readonly onJobFailed?: OnJobFailed;
}

type JobHandlers = Readonly<
  Record<string, (payload: object, context: Readonly<JobContext>) => Promise<void>>
>;

// the config parameter is a NoInfer site: the job set infers from the definitions alone, so a
// handler that omits its payload parameter cannot widen every job's payload type to object
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

async function startQueues(boss: PgBoss, defs: JobDefs): Promise<void> {
  await boss.start();

  for (const [name, def] of Object.entries(defs)) {
    const deadLetterName = def.deadLetter === true ? `${name}${DEAD_LETTER_SUFFIX}` : undefined;

    // pg-boss enforces the dead-letter reference with a foreign key, so the referenced queue
    // must exist before the queue that points at it is created.
    if (deadLetterName !== undefined) {
      await boss.createQueue(deadLetterName);
    }

    // pg-boss's createQueue upserts, so a second start against a migrated database is safe
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

interface FetchedJob {
  readonly data: unknown;
  readonly id: string;
  readonly retryCount: number;
  readonly retryLimit: number;
}

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

function runJob(
  boss: PgBoss,
  queueName: string,
  def: Readonly<JobDef>,
  handler: JobHandlers[string],
  onJobFailed: OnJobFailed,
  job: Readonly<FetchedJob>,
): Promise<JobOutcome> {
  return withRootSpan(`job.${queueName}`, async () => {
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

// pg-boss increments retryCount on refetch, before the handler runs, so this attempt is already
// counted; the comparison mirrors the condition pg-boss uses to pick retry or terminal on fail
function isRetriesExhausted(job: Readonly<Pick<FetchedJob, 'retryCount' | 'retryLimit'>>): boolean {
  return job.retryCount >= job.retryLimit;
}
