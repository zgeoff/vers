export const BUILD_BOUNDS = {
  // the longest silence in a healthy build's output over 72 Main legs was 146 s, during a compile
  // step; a push to Fly's registry that stalls on a shared layer stays silent until it is killed
  stallAfterSeconds: 180,

  // SIGINT is flyctl's ctrl-c, which ends the remote build; SIGKILL follows the grace
  stallGraceSeconds: 20,

  attempts: 2,
} as const;
