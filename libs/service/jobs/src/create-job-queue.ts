import { withRootSpan } from '@vers/service-utils';
import { PgBoss, fromKysely } from 'pg-boss';
import type { KyselyTransactionLike } from 'pg-boss';
import invariant from 'tiny-invariant';
import type { JobDef, JobDefMap, JobDefs, JobPayloads } from './types';

export interface SendJobOptions {
  readonly trx?: KyselyTransactionLike;
}

export interface DrainResult {
  readonly completed: number;
  readonly failed: number;
}

export type JobState = 'created' | 'retry' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface JobQueue<TPayloads extends JobPayloads> {
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly send: <TName extends keyof TPayloads & string>(
    name: TName,
    payload: Readonly<TPayloads[TName]>,
    opts?: Readonly<SendJobOptions>,
  ) => Promise<string>;
  readonly drain: (name?: Extract<keyof TPayloads, string>) => Promise<DrainResult>;
  readonly readJobState: (
    name: Extract<keyof TPayloads, string>,
    jobID: string,
  ) => Promise<JobState | undefined>;
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

type JobHandler<TPayload extends object> = (
  payload: Readonly<TPayload>,
  context: Readonly<JobContext>,
) => Promise<void>;

type JobHandlerMap<TPayloads extends JobPayloads> = {
  readonly [TName in keyof TPayloads]: JobHandler<TPayloads[TName]>;
};

export interface CreateJobQueueConfig<TPayloads extends JobPayloads> {
  readonly connectionString: string;
  readonly handlers: JobHandlerMap<TPayloads>;

  readonly onError?: (error: Error) => void;

  readonly onJobFailed?: OnJobFailed;
}

// the config parameter is a NoInfer site: the job set infers from the definitions alone, so a
// handler that omits its payload parameter cannot widen every job's payload type to object
export function createJobQueue<TPayloads extends JobPayloads>(
  defs: JobDefMap<TPayloads>,
  config: Readonly<CreateJobQueueConfig<NoInfer<TPayloads>>>,
): JobQueue<TPayloads> {
  const boss = new PgBoss(config.connectionString);

  boss.on('error', (error) => {
    (config.onError ?? printJobQueueError)(error);
  });

  const handlers = config.handlers;
  const onJobFailed = config.onJobFailed ?? printJobError;

  return {
    start: () => startQueues(boss, defs),
    stop: () => boss.stop(),
    send: (name, payload, opts) => sendJob(boss, defs, name, payload, opts),
    drain: (name) => drainJobs(boss, defs, handlers, onJobFailed, name),
    readJobState: (name, jobID) => readJobState(boss, name, jobID),
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

    const policy = {
      ...(deadLetterName === undefined ? {} : { deadLetter: deadLetterName }),
      ...buildQueuePolicy(def),
    };

    // pg-boss's createQueue ignores an existing queue, and updateQueue keeps every option it is
    // not sent, so the full policy goes through both to reach a queue an earlier start created
    await boss.createQueue(name, policy);
    await boss.updateQueue(name, policy);
  }
}

// pg-boss 12's own queue defaults, restored when a definition drops an option it once set
const DEFAULT_QUEUE_POLICY = {
  expireInSeconds: 15 * 60,
  retryBackoff: false,
  retryDelay: 0,
  retryLimit: 2,
} as const;

function buildQueuePolicy(def: Readonly<JobDef>): {
  readonly expireInSeconds: number;
  readonly retryBackoff: boolean;
  readonly retryDelay: number;
  readonly retryLimit: number;
} {
  return {
    expireInSeconds: def.expireInSeconds ?? DEFAULT_QUEUE_POLICY.expireInSeconds,
    retryBackoff: def.retryBackoff ?? DEFAULT_QUEUE_POLICY.retryBackoff,
    retryDelay: def.retryDelay ?? DEFAULT_QUEUE_POLICY.retryDelay,
    retryLimit: def.retryLimit ?? DEFAULT_QUEUE_POLICY.retryLimit,
  };
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

async function drainJobs<TPayloads extends JobPayloads>(
  boss: PgBoss,
  defs: JobDefMap<TPayloads>,
  handlers: JobHandlerMap<TPayloads>,
  onJobFailed: OnJobFailed,
  name: Extract<keyof TPayloads, string> | undefined,
): Promise<DrainResult> {
  const names: Array<Extract<keyof TPayloads, string>> = [];

  for (const queueName in defs) {
    if (name === undefined || queueName === name) {
      names.push(queueName);
    }
  }

  let completed = 0;
  let failed = 0;

  for (const queueName of names) {
    const def = defs[queueName];
    const handler = handlers[queueName];

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

interface FetchedJob {
  readonly data: unknown;
  readonly id: string;
  readonly retryCount: number;
  readonly retryLimit: number;
}

function runJob<TPayload extends object>(
  boss: PgBoss,
  queueName: string,
  def: Readonly<JobDef<TPayload>>,
  handler: JobHandler<TPayload>,
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

async function readJobState(
  boss: PgBoss,
  name: string,
  jobID: string,
): Promise<JobState | undefined> {
  const [job] = await boss.findJobs(name, { id: jobID });

  return job?.state;
}
