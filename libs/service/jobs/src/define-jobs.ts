import type { JobDefs } from './types';

export function defineJobs<const TDefs extends JobDefs>(defs: TDefs): TDefs {
  return defs;
}
