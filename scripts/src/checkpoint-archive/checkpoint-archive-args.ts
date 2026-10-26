import type { Args } from 'gunshi';

export const CHECKPOINT_ARCHIVE_ARGS = {
  sweep: {
    apply: {
      default: false,
      description: 'archive the rows and purge the expired archives',
      type: 'boolean',
    },
  },
  restore: {
    activity: { description: 'the activity id', metavar: 'id', required: true, type: 'string' },
  },
} as const satisfies Record<string, Args>;
