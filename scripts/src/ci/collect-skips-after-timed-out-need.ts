import { isConditionMet } from './is-condition-met';
import { isFailureHandler } from './is-failure-handler';
import type { SkipAfterTimedOutNeed, WorkflowJob } from './types';

// GitHub gives a need that hits its timeout-minutes the result 'cancelled', the same result a newer
// run's concurrency cancel gives, so a failure handler that refuses it reports no timeout
export function collectSkipsAfterTimedOutNeed(
  jobs: Map<string, WorkflowJob>,
): Array<SkipAfterTimedOutNeed> {
  return [...jobs]
    .filter(([, job]) => isFailureHandler(job))
    .flatMap(([name, job]) =>
      job.needs
        .filter((need) => !isConditionMet(job, buildTimedOutResults(job, need)))
        .map((timedOutJob) => ({ job: name, timedOutJob })),
    );
}

function buildTimedOutResults(job: WorkflowJob, timedOutJob: string): Map<string, string> {
  return new Map(job.needs.map((need) => [need, need === timedOutJob ? 'cancelled' : 'success']));
}
