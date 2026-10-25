import { buildPrefixXP } from './build-prefix-xp';
import type { ModelActivity, SettlementSnapshot, SnapshotActivity } from './types';

interface CollectSettlementViolationsInput {
  readonly activities: ReadonlyArray<ModelActivity>;
  readonly current: SettlementSnapshot;
  readonly previous: SettlementSnapshot;
}

// Each check reads the stored state against the generated streams alone, never against the
// reference model, so a rule the model shares with production still has to hold here.
export function collectSettlementViolations(
  input: Readonly<CollectSettlementViolationsInput>,
): Array<string> {
  return [
    ...collectRewardViolations(input),
    ...collectCursorViolations(input),
    ...collectPredecessorViolations(input),
  ];
}

function collectRewardViolations(input: Readonly<CollectSettlementViolationsInput>): Array<string> {
  const violations: Array<string> = [];

  const paidPositions = new Map<string, string>();
  const expectedItems = new Set<string>();

  for (const activity of input.activities) {
    const stored = findStoredActivity(input.current, activity.id);
    const verifiedHead = stored?.verifiedHead ?? 0;
    const provedXP = buildPrefixXP(activity.checkpoints, verifiedHead);

    if (stored !== undefined && stored.settledXP !== provedXP) {
      violations.push(
        `reward: ${activity.id} settled ${stored.settledXP} XP for a proved prefix worth ${provedXP}`,
      );
    }

    for (const checkpoint of activity.checkpoints.slice(0, verifiedHead)) {
      const chainIndex = activity.startChainIndex + checkpoint.entry.version;
      const position = `${activity.scopeID}:${chainIndex}`;
      const payer = paidPositions.get(position);

      if (checkpoint.type !== 'started' && payer !== undefined) {
        violations.push(`reward: ${activity.id} and ${payer} both settled position ${position}`);
      }

      if (checkpoint.type !== 'started') {
        paidPositions.set(position, activity.id);
      }

      for (const ordinal of checkpoint.rewardOrdinals) {
        expectedItems.add(`${position}:${ordinal}`);
      }
    }
  }

  const storedItems = new Set(input.current.items);

  const missing = [...expectedItems].filter((item) => !storedItems.has(item));
  const unproved = [...storedItems].filter((item) => !expectedItems.has(item));

  if (missing.length > 0 || unproved.length > 0) {
    violations.push(
      `reward: items missing [${missing.join(', ')}], items without a proved slot [${unproved.join(', ')}]`,
    );
  }

  return violations;
}

function findStoredActivity(
  snapshot: Readonly<SettlementSnapshot>,
  activityID: string,
): SnapshotActivity | undefined {
  return snapshot.activities.find((activity) => activity.id === activityID);
}

const STATUS_MOVES: ReadonlySet<string> = new Set([
  'active>active',
  'active>rejected',
  'active>stopped',
  'rejected>rejected',
  'stopped>rejected',
  'stopped>stopped',
]);

function collectCursorViolations(input: Readonly<CollectSettlementViolationsInput>): Array<string> {
  const violations: Array<string> = [];

  for (const activity of input.activities) {
    const stored = findStoredActivity(input.current, activity.id);
    const before = findStoredActivity(input.previous, activity.id);

    if (stored === undefined) {
      violations.push(`cursor: ${activity.id} has no stored row`);
      continue;
    }

    if (stored.verifiedHead > stored.appendedHead) {
      violations.push(
        `cursor: ${activity.id} verified ${stored.verifiedHead} past its appended head ${stored.appendedHead}`,
      );
    }

    if (activity.tamperedVersion !== null && stored.verifiedHead >= activity.tamperedVersion) {
      violations.push(
        `cursor: ${activity.id} verified its tampered checkpoint ${activity.tamperedVersion}`,
      );
    }

    if (before === undefined) {
      continue;
    }

    if (stored.appendedHead < before.appendedHead || stored.verifiedHead < before.verifiedHead) {
      violations.push(`cursor: ${activity.id} moved a head backward`);
    }

    if (!STATUS_MOVES.has(`${before.status}>${stored.status}`)) {
      violations.push(`cursor: ${activity.id} moved from ${before.status} to ${stored.status}`);
    }

    if (
      before.status === 'rejected' &&
      (stored.verifiedHead !== before.verifiedHead || stored.settledXP !== before.settledXP)
    ) {
      violations.push(`cursor: ${activity.id} settled more after its rejection`);
    }
  }

  for (const chain of input.current.chains) {
    const before = input.previous.chains.find((candidate) => candidate.scopeID === chain.scopeID);

    if (chain.appendedChainIndex < chain.verifiedChainIndex) {
      violations.push(
        `cursor: chain ${chain.scopeID} appended anchor sits behind its verified one`,
      );
    }

    if (before === undefined) {
      continue;
    }

    if (chain.verifiedChainIndex < before.verifiedChainIndex) {
      violations.push(`cursor: chain ${chain.scopeID} moved its verified anchor backward`);
    }

    if (
      chain.appendedChainIndex < before.appendedChainIndex &&
      chain.appendedChainIndex !== chain.verifiedChainIndex
    ) {
      violations.push(
        `cursor: chain ${chain.scopeID} pulled its appended anchor back past the verified one`,
      );
    }
  }

  return violations;
}

function collectPredecessorViolations(
  input: Readonly<CollectSettlementViolationsInput>,
): Array<string> {
  return input.activities.flatMap((activity) => {
    const stored = findStoredActivity(input.current, activity.id);

    if (stored === undefined || stored.verifiedHead === 0) {
      return [];
    }

    return collectAncestorIDs(input.activities, activity)
      .filter((ancestorID) => {
        const ancestor = findStoredActivity(input.current, ancestorID);

        return !(
          ancestor !== undefined &&
          (ancestor.status === 'rejected' ||
            (ancestor.status !== 'active' && ancestor.verifiedHead === ancestor.appendedHead))
        );
      })
      .map((ancestorID) => `predecessor: ${activity.id} settled before ${ancestorID} did`);
  });
}

function collectAncestorIDs(
  activities: ReadonlyArray<ModelActivity>,
  activity: Readonly<ModelActivity>,
): Array<string> {
  const predecessor = activities.find((candidate) => candidate.id === activity.predecessorID);

  return predecessor === undefined
    ? []
    : [predecessor.id, ...collectAncestorIDs(activities, predecessor)];
}
