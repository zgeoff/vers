interface FlyctlFailure {
  readonly args: ReadonlyArray<string>;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stalledAfterMs: number | null;
  readonly stderr: string;
  readonly stdout: string;
}

export class FlyctlError extends Error {
  readonly exitCode: number | null;

  readonly signal: NodeJS.Signals | null;

  readonly stalledAfterMs: number | null;

  readonly stderr: string;

  readonly stdout: string;

  constructor(failure: FlyctlFailure) {
    super(`flyctl ${failure.args.join(' ')} ${formatEnding(failure)}\n${failure.stderr}`.trimEnd());

    this.name = 'FlyctlError';
    this.exitCode = failure.exitCode;
    this.signal = failure.signal;
    this.stalledAfterMs = failure.stalledAfterMs;
    this.stderr = failure.stderr;
    this.stdout = failure.stdout;
  }
}

function formatEnding(failure: FlyctlFailure): string {
  const ending =
    failure.signal === null ? `exit code ${failure.exitCode}` : `signal ${failure.signal}`;

  return failure.stalledAfterMs === null
    ? `failed with ${ending}`
    : `wrote nothing for ${failure.stalledAfterMs} ms and was interrupted, ending with ${ending}`;
}
