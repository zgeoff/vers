import type { JobDefs } from './types';

/**
 * Identity helper whose only job is compile-time constraint of its literal argument: it pins each
 * job name to its own payload type so `createJobQueue`'s `handlers` and `send` can infer per-job
 * signatures instead of widening to a union across all jobs.
 */
export function defineJobs<const TDefs extends JobDefs>(defs: TDefs): TDefs {
  return defs;
}
