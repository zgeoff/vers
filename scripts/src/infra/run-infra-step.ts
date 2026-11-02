import { appendFile } from 'node:fs/promises';
import { formatSummarySection } from '../ci/format-summary-section';
import { runInfraStack } from './run-infra-stack';

interface InfraStepOptions {
  readonly infraPath: string;
  readonly stepName: string;
  readonly summaryPath: string;
}

interface InfraStepResult {
  readonly exitCode: number;
  readonly output: string;
}

interface InfraStep {
  readonly args: ReadonlyArray<string>;
  readonly heading: string;
}

const driftArgs = ['preview', '--refresh', '--diff', '--expect-no-changes'];

const infraSteps = new Map<string, InfraStep>([
  ['drift', { args: driftArgs, heading: 'Drift (prod)' }],
  ['drift-before', { args: driftArgs, heading: 'Drift before this change (prod)' }],
  ['change', { args: ['preview', '--refresh', '--diff'], heading: 'Planned change (prod)' }],
  [
    'apply',
    { args: ['up', '--refresh', '--yes', '--skip-preview', '--diff'], heading: 'Apply (prod)' },
  ],
  ['drift-after', { args: driftArgs, heading: 'Drift after the apply (prod)' }],
]);

export async function runInfraStep(options: Readonly<InfraStepOptions>): Promise<InfraStepResult> {
  const step = infraSteps.get(options.stepName);

  if (step === undefined) {
    return {
      exitCode: 2,
      output: `infra-step: no step named '${options.stepName}'; name one of ${[...infraSteps.keys()].join(', ')}\n`,
    };
  }

  const result = await runInfraStack({ args: step.args, infraPath: options.infraPath });

  const output = `${result.stdout}${result.stderr}`;

  await appendFile(
    options.summaryPath,
    formatSummarySection({
      heading: step.heading,
      language: 'text',
      body: output === '' ? `the step wrote no output (exit ${result.exitCode})` : output,
    }),
  );

  return { exitCode: result.exitCode, output };
}
