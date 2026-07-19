import type { ScheduledMachine, ScheduledMachineAction, ScheduledMachineState } from './types';

/**
 * Diffs a target's declared scheduled machines against its existing ones,
 * matched by name.
 */
export function planScheduledMachineActions(
  declarations: ReadonlyArray<ScheduledMachine>,
  image: string,
  existing: ReadonlyArray<ScheduledMachineState>,
): ReadonlyArray<ScheduledMachineAction> {
  const actions: Array<ScheduledMachineAction> = [];

  for (const declaration of declarations) {
    const current = findExisting(declaration.name, existing);

    if (current === undefined) {
      actions.push({ image, kind: 'create', machine: declaration });
      continue;
    }

    if (current.image !== image) {
      actions.push({ image, kind: 'update-image', machineID: current.id });
    }
  }

  return actions;
}

function findExisting(
  name: string,
  existing: ReadonlyArray<ScheduledMachineState>,
): ScheduledMachineState | undefined {
  return existing.find((machine) => machine.name === name);
}
