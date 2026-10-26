import type { ResourceSummary, ScenarioSummary } from './types';

interface CapacityStep {
  readonly busiest: ResourceSummary | undefined;
  readonly failedCalls: number;
  readonly meetsTarget: boolean;
  readonly players: number;
  readonly settlementP95Ms: number;
  readonly simulatedHoursPerHour: number;
}

interface CapacityVerdict {
  readonly limitingContainer: string | undefined;
  readonly steps: ReadonlyArray<CapacityStep>;
  readonly supportedPlayers: number | undefined;
}

const MS_PER_HOUR = 3_600_000;

// a step meets the target only when the pipeline kept up and lost nothing; the busiest container
// of the largest step that met it is the resource the next step runs out of first
export function buildCapacityVerdict(
  steady: ReadonlyArray<ScenarioSummary>,
  settlementTargetMs: number,
): CapacityVerdict {
  const steps = steady
    .map((summary) => {
      const failedCalls = Object.values(summary.delivery.failedByStatus).reduce(
        (sum, count) => sum + count,
        0,
      );

      return {
        busiest: summary.resources[0],
        failedCalls,
        meetsTarget:
          summary.settlementAgeMs.p95 <= settlementTargetMs &&
          failedCalls === 0 &&
          Object.keys(summary.delivery.refusals).length === 0 &&
          summary.reconciliation.held === 0 &&
          summary.reconciliation.unverified === 0,
        players: summary.players,
        settlementP95Ms: summary.settlementAgeMs.p95,
        simulatedHoursPerHour:
          (summary.workload.simulatedHours * MS_PER_HOUR) / Math.max(1, summary.playMs),
      };
    })
    .toSorted((left, right) => left.players - right.players);

  const supported = steps.findLast((step) => step.meetsTarget);

  return {
    limitingContainer: supported?.busiest?.container,
    steps,
    supportedPlayers: supported?.players,
  };
}
