const DAY_MS = 24 * 60 * 60 * 1000;

export const CHECKPOINT_RETENTION = {
  archiveRetentionMs: 90 * DAY_MS,
  hotWindowMs: DAY_MS,
  sweepLimit: 500,
} as const;
