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
  const results = new Map<string, string>([[cancelledJob, 'cancelled']]);

  const runs: Array<RunAfterCancelledNeed> = [];

  for (const name of order) {
    const job = jobs.get(name);

    invariant(job, `the job order holds ${name}, which the workflow lacks`);

    if (job.needs.some((need) => results.has(need))) {
      const ran = isConditionMet(job, results);
      const result = ran ? 'success' : 'skipped';

      results.set(name, result);

      if (ran) {
        runs.push({ job: name, cancelledJob });
      }
    }
  }

  return runs;
}

const STATUS_CALL = /\b(?:always|cancelled|failure|success)\s*\(/iu;

function isConditionMet(job: WorkflowJob, results: Map<string, string>): boolean {
  const needResults = new Map(job.needs.map((need) => [need, results.get(need) ?? 'success']));

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
