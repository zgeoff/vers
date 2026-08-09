import { findStaleReason } from './find-stale-reason';
import type { AppState, ChangeSet, DeployTarget } from './types';

/**
 * Evaluates a target's fleet state against HEAD and returns findings; an
 * empty array means the app is online and current. Machine-count rules
 * account for Fly auto-stop: existence is always required, but a started
 * machine only where the manifest demands warm capacity. A running machine
 * with a non-passing health check is a finding; a fully parked fleet is
 * indistinguishable from a crash-parked one here and is asserted by the
 * verify pass waking a machine instead.
 */
export function checkTarget(
  target: DeployTarget,
  state: AppState,
  changes: ChangeSet | null,
): ReadonlyArray<string> {
  const findings: Array<string> = [];

  if (state.machines.length === 0) {
    findings.push('no machines exist');
  }

  const started = state.machines.filter((machine) => machine.state === 'started').length;
  const minStarted = target.minStartedMachines ?? 0;

  if (started < minStarted) {
    findings.push(`${started} machines started, expected at least ${minStarted}`);
  }

  findings.push(...checkMachineHealth(state));

  const mixedImageFinding = findMixedImageFinding(state);

  if (mixedImageFinding !== null) {
    findings.push(mixedImageFinding);
  }

  const staleReason = state.machines.length === 0 ? null : findStaleReason(target, changes);

  if (staleReason !== null && !isSuppressedByMixedImages(staleReason, mixedImageFinding)) {
    findings.push(`stale: ${staleReason}`);
  }

  findings.push(...checkScheduledMachines(target, state));

  return findings;
}

function checkMachineHealth(state: AppState): ReadonlyArray<string> {
  const findings: Array<string> = [];

  for (const machine of state.machines) {
    if (machine.state !== 'started') {
      continue;
    }

    for (const check of machine.checks ?? []) {
      if (check.status !== 'passing') {
        findings.push(`machine ${machine.id} health check ${check.name} is ${check.status}`);
      }
    }
  }

  return findings;
}

function findMixedImageFinding(state: AppState): string | null {
  const counts = new Map<string, number>();

  for (const machine of state.machines) {
    if (machine.image === null) {
      continue;
    }

    counts.set(machine.image, (counts.get(machine.image) ?? 0) + 1);
  }

  if (counts.size <= 1) {
    return null;
  }

  const parts = [...counts.entries()]
    .toSorted(([imageA], [imageB]) => imageA.localeCompare(imageB))
    .map(([image, count]) => `${image} (${count} machine${count === 1 ? '' : 's'})`);

  return `fleet splits across ${counts.size} images: ${parts.join(', ')}`;
}

const NO_TRUSTWORTHY_SHA_REASON = 'no trustworthy deployed SHA recorded on the fleet';

/**
 * A mixed-image fleet already explains why no single deployed SHA is trustworthy — reporting both
 * findings would restate the same cause as two symptoms.
 */
function isSuppressedByMixedImages(staleReason: string, mixedImageFinding: string | null): boolean {
  return mixedImageFinding !== null && staleReason === NO_TRUSTWORTHY_SHA_REASON;
}

function checkScheduledMachines(target: DeployTarget, state: AppState): ReadonlyArray<string> {
  const findings: Array<string> = [];

  for (const declared of target.scheduledMachines ?? []) {
    const existing = state.scheduledMachines.find((machine) => machine.name === declared.name);

    if (existing === undefined) {
      findings.push(`scheduled machine ${declared.name} missing`);
      continue;
    }

    if (state.serviceImage !== null && existing.image !== state.serviceImage) {
      findings.push(`scheduled machine ${declared.name} image differs from service machines`);
    }
  }

  return findings;
}
