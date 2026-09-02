import { NO_TRUSTWORTHY_SHA_REASON, findStaleReason } from './find-stale-reason';
import type { AppState, ChangeSet, DeployTarget } from './types';

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

  const unreportedImageFinding = findUnreportedImageFinding(state);

  if (unreportedImageFinding !== null) {
    findings.push(unreportedImageFinding);
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

  // default string sort — code-unit order keeps the finding text identical across locales
  const parts = [...counts.keys()].toSorted().map((image) => {
    const count = counts.get(image) ?? 0;

    return `${image} (${count} machine${count === 1 ? '' : 's'})`;
  });

  return `fleet splits across ${counts.size} images: ${parts.join(', ')}`;
}

function findUnreportedImageFinding(state: AppState): string | null {
  const unreported = state.machines.filter((machine) => machine.image === null);

  if (unreported.length === 0 || state.machines.length === unreported.length) {
    return null;
  }

  const ids = unreported.map((machine) => machine.id).join(', ');

  return `machine(s) ${ids} report no image — flyctl did not read an image for them`;
}

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
