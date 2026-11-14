import { join } from 'node:path';
import { pickGateStep } from './pick-gate-step';

interface GateEnv {
  readonly eventPath: string;
  readonly tempDirectory: string;
}

// The step of the `verify / gate` check. The body comes from the event, as GitHub wrote it when the
// run started, so an `edited` run reads the report that `bun verify publish` just wrote.
export async function runVerifyGate(env: GateEnv): Promise<number> {
  const event: unknown = await Bun.file(env.eventPath).json();

  const step = pickGateStep(event);

  if (step.kind === 'refused') {
    process.stderr.write(`::error::${step.message}\n`);

    return 1;
  }

  if (step.kind === 'skip') {
    process.stdout.write(`verify gate skipped: ${step.reason}\n`);

    return 0;
  }

  const bodyFile = join(env.tempDirectory, 'pr-body.md');

  await Bun.write(bodyFile, step.body);

  const child = Bun.spawn(
    ['bun', 'verify', 'gate', '--base', `origin/${step.baseRef}`, '--body-file', bodyFile],
    { stdout: 'inherit', stderr: 'inherit' },
  );

  return child.exited;
}
