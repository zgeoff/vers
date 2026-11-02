import { appendFile } from 'node:fs/promises';
import { formatSummarySection } from '../ci/format-summary-section';
import { collectPlanHolds } from './collect-plan-holds';
import { formatPlanReport } from './format-plan-report';
import { parsePulumiPlan } from './parse-pulumi-plan';
import { pickInfraOutcome } from './pick-infra-outcome';
import { runInfraStack } from './run-infra-stack';
import type { DriftOutcome, InfraStackResult, PulumiPlan } from './types';

interface InfraPlanCheckOptions {
  readonly commit: string;
  readonly drift: DriftOutcome;
  readonly event: string;
  readonly infraPath: string;
  readonly mainTip: string;
  readonly outputPath: string;
  readonly summaryPath: string;
}

interface InfraPlanCheckResult {
  readonly exitCode: number;
  readonly output: string;
}

const driftHold =
  'the preview before this change found changes: drift, or an earlier change that the guard held';

export async function runInfraPlanCheck(
  options: Readonly<InfraPlanCheckOptions>,
): Promise<InfraPlanCheckResult> {
  const result = await runInfraStack({
    args: ['preview', '--refresh', '--json'],
    infraPath: options.infraPath,
  });

  const plan = parsePulumiPlan(result.stdout);

  if (result.exitCode !== 0 || plan === undefined) {
    const output = formatSummarySection({
      heading: 'Apply plan (prod)',
      language: 'text',
      body: formatPreviewFailure(result, plan),
    });

    await appendFile(options.summaryPath, output);

    return { exitCode: 1, output };
  }

  const isMainTip = options.commit === options.mainTip;
  const isStaleDispatch = options.event === 'workflow_dispatch' && !isMainTip;

  const holds = [
    ...(isStaleDispatch
      ? [`this run's commit ${options.commit} is not main's tip ${options.mainTip}`]
      : []),
    ...(options.drift === 'failure' ? [driftHold] : []),
    ...collectPlanHolds(plan),
  ];

  const outcome = pickInfraOutcome({ event: options.event, holds, isMainTip });
  const output = formatPlanReport({ holds, outcome, steps: plan.steps });

  await appendFile(options.outputPath, `outcome=${outcome}\n`);
  await appendFile(options.summaryPath, output);

  return { exitCode: 0, output };
}

function formatPreviewFailure(
  result: Readonly<InfraStackResult>,
  plan: Readonly<PulumiPlan> | undefined,
): string {
  const errors = (plan?.diagnostics ?? [])
    .filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => diagnostic.message.trimEnd());

  return [
    result.exitCode === 0
      ? 'the preview printed no plan'
      : `the preview failed (exit ${result.exitCode})`,
    ...errors,
    result.stderr.trimEnd(),
  ]
    .filter((line) => line !== '')
    .join('\n');
}
