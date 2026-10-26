import { buildCapacityVerdict } from './build-capacity-verdict';
import { formatContainerExit } from './format-container-exit';
import type { LoadReportContext, ScenarioSummary } from './types';

export function renderLoadReport(
  context: Readonly<LoadReportContext>,
  summaries: ReadonlyArray<ScenarioSummary>,
): string {
  const steady = summaries.filter((summary) => summary.name.startsWith('steady-'));

  const lines = [
    '# Load run',
    '',
    `Commit ${context.commit}, sim version \`${context.versions.current}\` and retained \`${context.versions.retained}\`. Each service container runs with its Fly machine's memory and ${context.serviceCPUs} CPU; postgres has ${context.postgresCPUs} CPUs.`,
    '',
  ];

  if (steady.length > 0) {
    lines.push(...renderCapacity(steady, context.settlementTargetMs));
  }

  for (const summary of summaries) {
    lines.push(...renderScenario(summary));
  }

  return lines.join('\n');
}

function renderCapacity(
  steady: ReadonlyArray<ScenarioSummary>,
  settlementTargetMs: number,
): Array<string> {
  const verdict = buildCapacityVerdict(steady, settlementTargetMs);

  return [
    '## Capacity',
    '',
    `Target: settlement age p95 at or under ${formatSeconds(settlementTargetMs)} with no failed delivery, no held activity, and a backlog that drains after play stops.`,
    '',
    '| Connected players | Simulated hours per wall hour | Settlement p95 | Failed calls | Busiest container | Its mean CPU | Meets target |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...verdict.steps.map(
      (step) =>
        `| ${step.players} | ${step.simulatedHoursPerHour.toFixed(0)} | ${formatSeconds(step.settlementP95Ms)} | ${step.failedCalls} | ${step.busiest?.container ?? 'none'} | ${formatPercent(step.busiest?.cpuMeanPercent ?? 0)} | ${step.meetsTarget ? 'yes' : 'no'} |`,
    ),
    '',
    verdict.supportedPlayers === undefined
      ? 'Supported: no measured step met the target.'
      : `Supported: ${verdict.supportedPlayers} connected players.`,
    `Next limiting resource: ${verdict.limitingContainer ?? 'none measured'}${verdict.limitingExit === undefined ? '' : `, which ${formatContainerExit(verdict.limitingExit)}`}.`,
    '',
  ];
}

function formatSeconds(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function formatPercent(percent: number): string {
  return `${percent.toFixed(0)}%`;
}

const MIB = 1024 ** 2;

function renderScenario(summary: Readonly<ScenarioSummary>): Array<string> {
  const ages = summary.settlementAgeMs;
  const delivery = summary.delivery;
  const reconciliation = summary.reconciliation;
  const transactions = summary.transactions;

  return [
    `## ${summary.name}: ${summary.players} players`,
    '',
    ...[
      ...summary.events,
      ...summary.exits.map((exit) => ({
        elapsedMs: exit.elapsedMs,
        label: `${exit.container} ${formatContainerExit(exit)}`,
      })),
    ]
      .toSorted((left, right) => left.elapsedMs - right.elapsedMs)
      .map((event) => `- ${formatSeconds(event.elapsedMs)}: ${event.label}`),
    `- settled ${summary.settleMs === undefined ? 'not within the timeout' : `${formatSeconds(summary.settleMs)} after play stopped`}`,
    ...(summary.recoveryMs === undefined
      ? []
      : [
          `- backlog back to its pre-outage level ${formatSeconds(summary.recoveryMs)} after the dependency returned`,
        ]),
    '',
    '| Measure | Value |',
    '| --- | --- |',
    `| Simulated workload | ${summary.workload.simulatedHours.toFixed(1)} h in ${summary.workload.activities} activities, ${summary.workload.checkpoints} checkpoints |`,
    `| Attempt outcomes | ${formatCounts(summary.workload.outcomes)} |`,
    `| Completed work, peak | ${summary.workload.peakVerifiedPerMinute.toFixed(0)} checkpoints verified per minute |`,
    `| Settlement age | p50 ${formatSeconds(ages.p50)}, p95 ${formatSeconds(ages.p95)}, p99 ${formatSeconds(ages.p99)}, max ${formatSeconds(ages.max)} over ${ages.count} checkpoints |`,
    `| Lock waits past 100 ms | ${transactions.lockWaits} (p95 ${transactions.lockWaitP95Ms.toFixed(0)} ms, max ${transactions.lockWaitMaxMs.toFixed(0)} ms; ${formatCounts(transactions.byLock)}) |`,
    `| Peak lock waiters, longest transaction | ${transactions.peakLockWaiters}, ${transactions.longestTransactionMs.toFixed(0)} ms |`,
    `| Failed calls | ${delivery.calls} calls, ${formatCounts(delivery.failedByStatus)} |`,
    `| Refusals | ${formatCounts(delivery.refusals)} |`,
    `| Activities backed off, peak | ${delivery.peakBackedOff} |`,
    `| End state | ${reconciliation.unverified} checkpoints unproved, ${reconciliation.held} activities held, ${reconciliation.runXPMismatches} run and ${reconciliation.avatarXPMismatches} avatar XP mismatches |`,
    '',
    '| Procedure | Calls | Failed | p50 | p95 |',
    '| --- | --- | --- | --- | --- |',
    ...delivery.procedures.map(
      (procedure) =>
        `| ${procedure.procedure} | ${procedure.calls} | ${procedure.failures} | ${procedure.p50Ms.toFixed(0)} ms | ${procedure.p95Ms.toFixed(0)} ms |`,
    ),
    '',
    '| Container | CPU mean | CPU p95 | Memory peak |',
    '| --- | --- | --- | --- |',
    ...summary.resources.map(
      (resource) =>
        `| ${resource.container} | ${formatPercent(resource.cpuMeanPercent)} | ${formatPercent(resource.cpuP95Percent)} | ${(resource.memoryPeakBytes / MIB).toFixed(0)} MiB |`,
    ),
    '',
  ];
}

function formatCounts(counts: Readonly<Record<string, number>>): string {
  const entries = Object.entries(counts);

  return entries.length === 0
    ? 'none'
    : entries.map(([key, count]) => `${key} ${count}`).join(', ');
}
