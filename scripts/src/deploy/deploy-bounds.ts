export const DEPLOY_BOUNDS = {
  // flyctl's own wait for each machine to start and turn healthy, after which it rolls back itself
  waitTimeoutMinutes: 3,

  // app-web's probes at worst: two request probes through every retry and two Lighthouse runs
  probeBudgetMinutes: 4,

  // the release record after the probes pass: one flyctl image read and one database write
  releaseRecordMinutes: 2,

  // a flyctl that outlives its own wait gets SIGINT, which runs flyctl's ctrl-c rollback
  interruptAfterMinutes: 10,
  interruptGraceMinutes: 2,
} as const;
