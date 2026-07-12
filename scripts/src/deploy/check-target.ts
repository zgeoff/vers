import { findStaleReason } from './find-stale-reason';
import type { AppState, ChangeSet, DeployTarget } from './types';

/**
 * Evaluates a target's fleet state against HEAD and returns findings; an
 * empty array means the app is online and current. Machine-count rules
 * account for Fly auto-suspend: existence is always required, but a started
 * machine only where the manifest demands warm capacity.
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

  const staleReason = state.machines.length === 0 ? null : findStaleReason(target, changes);

  if (staleReason !== null) {
    findings.push(`stale: ${staleReason}`);
  }

  findings.push(...checkScheduledMachines(target, state));

  return findings;
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
