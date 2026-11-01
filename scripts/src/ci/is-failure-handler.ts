import { isConditionMet } from './is-condition-met';
import type { WorkflowJob } from './types';

export function isFailureHandler(job: WorkflowJob): boolean {
  const allSucceeded = new Map(job.needs.map((need) => [need, 'success']));

  return (
    job.needs.length > 0 &&
    !isConditionMet(job, allSucceeded) &&
    job.needs.some((need) => isConditionMet(job, new Map(allSucceeded).set(need, 'failure')))
  );
}
