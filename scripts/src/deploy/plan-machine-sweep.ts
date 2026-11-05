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
  const imageless = machines.filter((machine) => machine.image === null);

  if (groups.size === 0 || (groups.size === 1 && imageless.length === 0)) {
    return { kind: 'clean' };
  }

  const startedImageless = findStartedImagelessAmbiguity(imageless);

  if (startedImageless !== null) {
    return startedImageless;
  }

  const keep = groups.size === 1 ? pickOnlyImage(groups) : pickKeepImage(groups, recordedRelease);

  if (keep.kind === 'ambiguous') {
    return keep;
  }

  const strandedOnImage = [...groups.entries()]
    .filter(([image]) => image !== keep.image)
    .flatMap(([, group]) => group);

  const startedOutsideKeep = strandedOnImage.filter((machine) => machine.state === 'started');

  if (startedOutsideKeep.length > 0) {
    const ids = startedOutsideKeep.map((machine) => machine.id).join(', ');

    return {
      kind: 'ambiguous',
      reason: `machine(s) ${ids} are started on an image outside the kept group — refusing to destroy a started machine`,
    };
  }

  return {
    kind: 'sweep',
    machines: [...strandedOnImage, ...imageless].map((machine) => ({
      id: machine.id,
      image: machine.image,
    })),
  };
}

function buildImageGroups(
  machines: ReadonlyArray<AppMachine>,
): ReadonlyMap<string, ReadonlyArray<AppMachine>> {
  const groups = new Map<string, Array<AppMachine>>();

  for (const machine of machines) {
    if (machine.image === null) {
      continue;
    }

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

function findStartedImagelessAmbiguity(
  imageless: ReadonlyArray<AppMachine>,
): AmbiguousResult | null {
  const started = imageless.filter((machine) => machine.state === 'started');

  if (started.length === 0) {
    return null;
  }

  const ids = started.map((machine) => machine.id).join(', ');

  return {
    kind: 'ambiguous',
    reason: `machine(s) ${ids} are started and report no image — flyctl did not read an image for them, so the fleet's image groups cannot be trusted`,
  };
}

interface KeepImage {
  readonly image: string;
  readonly kind: 'keep';
}

function pickOnlyImage(groups: ReadonlyMap<string, ReadonlyArray<AppMachine>>): KeepImage {
  const [image] = groups.keys();

  invariant(image !== undefined, 'groups has exactly one image');

  return { image, kind: 'keep' };
}

function pickKeepImage(
  groups: ReadonlyMap<string, ReadonlyArray<AppMachine>>,
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
