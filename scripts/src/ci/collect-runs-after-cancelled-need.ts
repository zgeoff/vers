import invariant from 'tiny-invariant';
import { isConditionMet } from './is-condition-met';
import { isFailureHandler } from './is-failure-handler';
import type { RunAfterCancelledNeed, WorkflowJob } from './types';

export function collectRunsAfterCancelledNeed(
  jobs: Map<string, WorkflowJob>,
): Array<RunAfterCancelledNeed> {
  const order = collectJobOrder(jobs);

  // a failure handler runs after a cancelled need so that a timed-out need reports, and it asks
  // whether a newer run exists to drop the cancel that run caused
  return [...jobs]
    .filter(([, job]) => job.cancelsInProgress)
    .flatMap(([cancelledJob]) => collectRunsAfter(jobs, order, cancelledJob))
    .filter((run) => !isFailureHandler(getJob(jobs, run.job)));
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
    const job = getJob(jobs, name);

    if (job.needs.some((need) => need === cancelledJob || reached.has(need))) {
      reached.add(name);
    }
  }

  return reached;
}

function getJob(jobs: Map<string, WorkflowJob>, name: string): WorkflowJob {
  const job = jobs.get(name);

  invariant(job, `the job order holds ${name}, which the workflow lacks`);

  return job;
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

  const job = getJob(walk.jobs, name);
  const ran = walk.reached.has(name) && isConditionMet(job, walk.results);

  if (ran) {
    walk.ranJobs.add(name);
  }

  for (const result of pickResults(walk.reached.has(name), ran)) {
    walkResults({ ...walk, order: rest, results: new Map(walk.results).set(name, result) });
  }
}

const UNREACHED_RESULTS = ['success', 'failure', 'skipped'];
const RAN_RESULTS = ['success', 'failure'];

function pickResults(isReached: boolean, ran: boolean): Array<string> {
  if (!isReached) {
    return UNREACHED_RESULTS;
  }

  return ran ? RAN_RESULTS : ['skipped'];
}
