import { runDrainLoop, withRootSpan } from '@vers/service-utils';
import { PgBoss, fromKysely } from 'pg-boss';
import type { KyselyTransactionLike } from 'pg-boss';
import invariant from 'tiny-invariant';
import { JOB_QUEUE_STOP_TIMEOUT_MS } from './job-queue-stop-timeout-ms';
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
    stop: () => boss.stop({ timeout: JOB_QUEUE_STOP_TIMEOUT_MS }),
    send: (name, payload, opts) => sendJob({ boss, defs, name, payload, opts }),
    drain: (name) => drainJobs({ boss, defs, handlers, onJobFailed, name }),
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

interface SendJobInput {
  readonly boss: PgBoss;
  readonly defs: JobDefs;
  readonly name: string;
  readonly payload: object;
  readonly opts: Readonly<SendJobOptions> | undefined;
}

async function sendJob(input: SendJobInput): Promise<string> {
  const def = input.defs[input.name];

  invariant(def, `job "${input.name}" is not defined`);

  const data: object = def.schema.parse(input.payload);

  const sendOptions =
    input.opts?.trx === undefined ? undefined : { db: fromKysely(input.opts.trx) };

  const jobID = await input.boss.send(input.name, data, sendOptions);

  invariant(jobID !== null, `pg-boss accepted the send but returned no job id for "${input.name}"`);

  return jobID;
}

interface DrainJobsOptions<TPayloads extends JobPayloads> {
  readonly boss: PgBoss;
  readonly defs: JobDefMap<TPayloads>;
  readonly handlers: JobHandlerMap<TPayloads>;
  readonly onJobFailed: OnJobFailed;
  readonly name: Extract<keyof TPayloads, string> | undefined;
}

type JobOutcome = 'completed' | 'failed';

async function drainJobs<TPayloads extends JobPayloads>(
  options: DrainJobsOptions<TPayloads>,
): Promise<DrainResult> {
  const names: Array<Extract<keyof TPayloads, string>> = [];

  for (const queueName in options.defs) {
    if (options.name === undefined || queueName === options.name) {
      names.push(queueName);
    }
  }

  let completed = 0;
  let failed = 0;

  for (const queueName of names) {
    const def = options.defs[queueName];
    const handler = options.handlers[queueName];

    const batches = await runDrainLoop(async () => {
      const jobs = await options.boss.fetch<unknown>(queueName, {
        batchSize: 10,
        includeMetadata: true,
      });

      if (jobs.length === 0) {
        return null;
      }

      const outcomes: Array<JobOutcome> = [];

      for (const job of jobs) {
        const outcome = await runJob({
          boss: options.boss,
          queueName,
          def,
          handler,
          onJobFailed: options.onJobFailed,
          job,
        });

        outcomes.push(outcome);
      }

      return outcomes;
    });

    for (const outcome of batches.flat()) {
      if (outcome === 'completed') {
        completed += 1;
      } else {
        failed += 1;
      }
    }
  }

  return { completed, failed };
}

interface FetchedJob {
  readonly data: unknown;
  readonly id: string;
  readonly retryCount: number;
  readonly retryLimit: number;
}

interface RunJobOptions<TPayload extends object> {
  readonly boss: PgBoss;
  readonly queueName: string;
  readonly def: Readonly<JobDef<TPayload>>;
  readonly handler: JobHandler<TPayload>;
  readonly onJobFailed: OnJobFailed;
  readonly job: Readonly<FetchedJob>;
}

function runJob<TPayload extends object>(options: RunJobOptions<TPayload>): Promise<JobOutcome> {
  const boss = options.boss;
  const queueName = options.queueName;
  const job = options.job;

  return withRootSpan(`job.${queueName}`, async () => {
    const parsed = options.def.schema.safeParse(job.data);

    if (!parsed.success) {
      // reported before the fail round-trip so a rejecting `fail` can never mask the cause
      options.onJobFailed(
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
      await options.handler(parsed.data, { jobID: job.id });
      await boss.complete(queueName, job.id);

      return 'completed';
    } catch (error) {
      // reported before the fail round-trip so a rejecting `fail` can never mask the cause
      options.onJobFailed(error, {
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
