import type { ContainerExit, ResourceSummary, ScenarioSummary } from './types';

interface CapacityStep {
  readonly busiest: ResourceSummary | undefined;
  readonly exits: ReadonlyArray<ContainerExit>;
  readonly failedCalls: number;
  readonly meetsTarget: boolean;
  readonly players: number;
  readonly settlementP95Ms: number;
  readonly simulatedHoursPerHour: number;
}

interface CapacityVerdict {
  readonly limitingContainer: string | undefined;
  readonly limitingExit: ContainerExit | undefined;
  readonly steps: ReadonlyArray<CapacityStep>;
  readonly supportedPlayers: number | undefined;
}

const MS_PER_HOUR = 3_600_000;

// a step meets the target only when the pipeline kept up, lost nothing and kept every container
// up; the limit is what broke in the first step that missed it: a container that exited, or else
// its busiest container
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
        exits: summary.exits,
        failedCalls,
        meetsTarget:
          summary.settlementAgeMs.p95 <= settlementTargetMs &&
          failedCalls === 0 &&
          summary.exits.length === 0 &&
          Object.keys(summary.delivery.refusals).length === 0 &&
          summary.reconciliation.held === 0 &&
          summary.reconciliation.unverified === 0 &&
          summary.reconciliation.runXPMismatches === 0 &&
          summary.reconciliation.avatarXPMismatches === 0,
        players: summary.players,
        settlementP95Ms: summary.settlementAgeMs.p95,
        simulatedHoursPerHour:
          (summary.workload.simulatedHours * MS_PER_HOUR) / Math.max(1, summary.playMs),
      };
    })
    .toSorted((left, right) => left.players - right.players);

  const supported = steps.findLast((step) => step.meetsTarget);
  const limited = steps.find((step) => !step.meetsTarget) ?? steps.at(-1);
  const limitingExit = limited?.exits[0];

  return {
    limitingContainer: limitingExit?.container ?? limited?.busiest?.container,
    limitingExit,
    steps,
    supportedPlayers: supported?.players,
  };
}
