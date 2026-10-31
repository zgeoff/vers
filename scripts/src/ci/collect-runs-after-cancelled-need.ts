import { Evaluator, Lexer, Parser, data } from '@actions/expressions';
import type { FunctionDefinition } from '@actions/expressions/funcs/info';
import { truthy } from '@actions/expressions/result';
import invariant from 'tiny-invariant';
import type { RunAfterCancelledNeed, WorkflowJob } from './types';

export function collectRunsAfterCancelledNeed(
  jobs: Map<string, WorkflowJob>,
): Array<RunAfterCancelledNeed> {
  const order = collectJobOrder(jobs);

  return [...jobs]
    .filter(([, job]) => job.cancelsInProgress)
    .flatMap(([cancelledJob]) => collectRunsAfter(jobs, order, cancelledJob));
}

function collectJobOrder(jobs: Map<string, WorkflowJob>): Array<string> {
  const order: Array<string> = [];

  for (const name of jobs.keys()) {
    visitJob(jobs, name, order);
  }

  return order;
}

function visitJob(jobs: Map<string, WorkflowJob>, name: string, order: Array<string>) {
  const job = jobs.get(name);

  if (job === undefined || order.includes(name)) {
    return;
  }

  for (const need of job.needs) {
    visitJob(jobs, need, order);
  }

  order.push(name);
}

function collectRunsAfter(
  jobs: Map<string, WorkflowJob>,
  order: Array<string>,
  cancelledJob: string,
): Array<RunAfterCancelledNeed> {
  const reached = collectReachedJobs(jobs, order, cancelledJob);

  const readNeeds = new Set([...reached].flatMap((name) => jobs.get(name)?.needs ?? []));
  const ranJobs = new Set<string>();

  walkResults({
    jobs,
    order: order.filter(
      (name) => name !== cancelledJob && (reached.has(name) || readNeeds.has(name)),
    ),
    reached,
    results: new Map([[cancelledJob, 'cancelled']]),
    ranJobs,
  });

  return order.filter((name) => ranJobs.has(name)).map((job) => ({ job, cancelledJob }));
}

function collectReachedJobs(
  jobs: Map<string, WorkflowJob>,
  order: Array<string>,
  cancelledJob: string,
): Set<string> {
  const reached = new Set<string>();

  for (const name of order) {
    const job = jobs.get(name);

    invariant(job, `the job order holds ${name}, which the workflow lacks`);

    if (job.needs.some((need) => need === cancelledJob || reached.has(need))) {
      reached.add(name);
    }
  }

  return reached;
}

interface ResultWalk {
  jobs: Map<string, WorkflowJob>;
  order: Array<string>;
  reached: Set<string>;
  results: Map<string, string>;
  ranJobs: Set<string>;
}

function walkResults(walk: ResultWalk) {
  const [name, ...rest] = walk.order;

  if (name === undefined) {
    return;
  }

  const job = walk.jobs.get(name);

  invariant(job, `the job order holds ${name}, which the workflow lacks`);

  const ran = walk.reached.has(name) && isConditionMet(job, walk.results);

  if (ran) {
    walk.ranJobs.add(name);
  }

  for (const result of pickResults(walk.reached.has(name), ran)) {
    walkResults({ ...walk, order: rest, results: new Map(walk.results).set(name, result) });
  }
}

const STATUS_CALL = /\b(?:always|cancelled|failure|success)\s*\(/iu;

function isConditionMet(job: WorkflowJob, results: Map<string, string>): boolean {
  const needResults = new Map(
    job.needs.map((need) => {
      const result = results.get(need);

      invariant(result !== undefined, `${need} has no result before ${job.condition} reads it`);

      return [need, result];
    }),
  );

  const statusFunctions = buildStatusFunctions([...needResults.values()]);

  // GitHub adds success() to an `if:` that calls no status function
  const expression = STATUS_CALL.test(job.condition)
    ? job.condition
    : `success() && (${job.condition})`;

  const lexed = new Lexer(expression).lex();
  const parsed = new Parser(lexed.tokens, ['needs'], [...statusFunctions.values()]).parse();

  const needs = new data.Dictionary(
    ...[...needResults].map(([need, result]) => ({
      key: need,
      value: new data.Dictionary({ key: 'result', value: new data.StringData(result) }),
    })),
  );

  return truthy(
    new Evaluator(
      parsed,
      new data.Dictionary({ key: 'needs', value: needs }),
      statusFunctions,
    ).evaluate(),
  );
}

function buildStatusFunctions(needResults: Array<string>): Map<string, FunctionDefinition> {
  const statuses: Record<string, boolean> = {
    always: true,

    // a job that its own concurrency group cancels leaves cancelled() false for the rest of the run
    cancelled: false,
    failure: needResults.includes('failure'),
    success: needResults.every((result) => result === 'success'),
  };

  return new Map(
    Object.entries(statuses).map(([name, status]): [string, FunctionDefinition] => [
      name,
      { name, minArgs: 0, maxArgs: 0, call: () => new data.BooleanData(status) },
    ]),
  );
}

const UNREACHED_RESULTS = ['success', 'failure', 'skipped'];
const RAN_RESULTS = ['success', 'failure'];

function pickResults(isReached: boolean, ran: boolean): Array<string> {
  if (!isReached) {
    return UNREACHED_RESULTS;
  }

  return ran ? RAN_RESULTS : ['skipped'];
}
