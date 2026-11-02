import { match } from 'ts-pattern';
import type { InfraOutcome, PulumiPlanStep } from './types';

interface PlanReport {
  readonly holds: ReadonlyArray<string>;
  readonly outcome: InfraOutcome;
  readonly steps: ReadonlyArray<PulumiPlanStep>;
}

// the job's log and summary are public, so the report names each step's op and URN, never a
// resource's state
export function formatPlanReport(report: Readonly<PlanReport>): string {
  return [
    '## Apply plan (prod)',
    '',
    formatVerdict(report),
    '',
    formatSteps(report.steps),
    '',
  ].join('\n');
}

const dispatchCommand = 'gh workflow run infra-deploy.yml --ref main';

function formatVerdict(report: Readonly<PlanReport>): string {
  const holdList = report.holds.map((hold) => `- ${hold}`).join('\n');

  return match(report)
    .with(
      { outcome: 'apply', holds: [] },
      () => 'The guard passed the plan, so the job applies it.',
    )
    .with(
      { outcome: 'apply' },
      () =>
        `The guard held the plan for these reasons, and the job applies it because a person dispatched the run:\n\n${holdList}`,
    )
    .with(
      { outcome: 'held' },
      () =>
        `The guard held the plan for a person, for these reasons:\n\n${holdList}\n\nTo apply the plan of main's tip, dispatch the workflow: \`${dispatchCommand}\``,
    )
    .exhaustive();
}

function formatSteps(steps: ReadonlyArray<PulumiPlanStep>): string {
  const changes = steps.filter((step) => step.op !== 'same');

  if (changes.length === 0) {
    return 'The plan changes no resource.';
  }

  return [
    '| Op | Resource |',
    '| --- | --- |',
    ...changes.map((step) => `| \`${step.op}\` | \`${step.urn}\` |`),
  ].join('\n');
}
