import type { Args } from 'gunshi';

export const QA_COLD_ARGS = {
  wait: {
    default: false,
    description: 'poll until every machine reports suspended or stopped',
    type: 'boolean',
  },
  'dry-run': {
    default: false,
    description: 'print the guard verdict and the planned actions without acting',
    type: 'boolean',
  },
  force: {
    default: false,
    description: 'skip the traffic guard; refused for the production fleet',
    type: 'boolean',
  },
} as const satisfies Args;
