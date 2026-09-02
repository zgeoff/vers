import invariant from 'tiny-invariant';
import type { AppMachine, MachineSweepTarget } from './types';

export type MachineSweepPlan =
  | { readonly kind: 'clean' }
  | { readonly kind: 'sweep'; readonly machines: ReadonlyArray<MachineSweepTarget> }
  | { readonly kind: 'ambiguous'; readonly reason: string };

export function planMachineSweep(
  machines: ReadonlyArray<AppMachine>,
  recordedRelease: { readonly gitSHA: string } | null,
): MachineSweepPlan {
  const groups = buildImageGroups(machines);

  if (groups.size <= 1) {
    return { kind: 'clean' };
  }

  const unknownImage = findUnknownImageAmbiguity(groups);

  if (unknownImage !== null) {
    return unknownImage;
  }

  const keep = pickKeepImage(groups, recordedRelease);

  if (keep.kind === 'ambiguous') {
    return keep;
  }

  const stranded = [...groups.entries()]
    .filter(([image]) => image !== keep.image)
    .flatMap(([, group]) => group);

  const startedOutsideKeep = stranded.filter((machine) => machine.state === 'started');

  if (startedOutsideKeep.length > 0) {
    const ids = startedOutsideKeep.map((machine) => machine.id).join(', ');

    return {
      kind: 'ambiguous',
      reason: `machine(s) ${ids} are started on an image outside the kept group — refusing to destroy a started machine`,
    };
  }

  return {
    kind: 'sweep',
    machines: stranded.map((machine) => ({ id: machine.id, image: machine.image })),
  };
}

function buildImageGroups(
  machines: ReadonlyArray<AppMachine>,
): ReadonlyMap<string | null, ReadonlyArray<AppMachine>> {
  const groups = new Map<string | null, Array<AppMachine>>();

  for (const machine of machines) {
    const group = groups.get(machine.image);

    if (group === undefined) {
      groups.set(machine.image, [machine]);
      continue;
    }

    group.push(machine);
  }

  return groups;
}

interface AmbiguousResult {
  readonly kind: 'ambiguous';
  readonly reason: string;
}

function findUnknownImageAmbiguity(
  groups: ReadonlyMap<string | null, ReadonlyArray<AppMachine>>,
): AmbiguousResult | null {
  const unknown = groups.get(null);

  if (unknown === undefined) {
    return null;
  }

  const ids = unknown.map((machine) => machine.id).join(', ');

  return {
    kind: 'ambiguous',
    reason: `machine(s) ${ids} report no image — flyctl did not read an image for them, so the fleet's image groups cannot be trusted`,
  };
}

interface KeepImage {
  readonly image: string | null;
  readonly kind: 'keep';
}

function pickKeepImage(
  groups: ReadonlyMap<string | null, ReadonlyArray<AppMachine>>,
  recordedRelease: { readonly gitSHA: string } | null,
): KeepImage | AmbiguousResult {
  if (recordedRelease !== null) {
    const matching = [...groups.entries()].filter(([, group]) =>
      group.every((machine) => machine.gitSHA === recordedRelease.gitSHA),
    );

    if (matching.length === 1) {
      const [entry] = matching;

      invariant(entry, 'matching has exactly one entry');

      return { image: entry[0], kind: 'keep' };
    }
  }

  const healthy = [...groups.entries()].filter(([, group]) =>
    group.some((machine) => isHealthyStarted(machine)),
  );

  if (healthy.length === 1) {
    const [entry] = healthy;

    invariant(entry, 'healthy has exactly one entry');

    return { image: entry[0], kind: 'keep' };
  }

  if (healthy.length === 0) {
    return {
      kind: 'ambiguous',
      reason:
        recordedRelease === null
          ? 'no recorded release to match, and no image group has a healthy started machine'
          : `no image group matches the recorded release SHA ${recordedRelease.gitSHA}, and no image group has a healthy started machine`,
    };
  }

  return {
    kind: 'ambiguous',
    reason: `${healthy.length} image groups each have a healthy started machine — ambiguous which is current`,
  };
}

function isHealthyStarted(machine: AppMachine): boolean {
  const checks = machine.checks ?? [];

  return (
    machine.state === 'started' &&
    checks.length > 0 &&
    checks.every((check) => check.status === 'passing')
  );
}
