import type { ScheduledMachine, ScheduledMachineAction, ScheduledMachineState } from './types';

export function planScheduledMachineActions(
  declarations: ReadonlyArray<ScheduledMachine>,
  image: string,
  existing: ReadonlyArray<ScheduledMachineState>,
): ReadonlyArray<ScheduledMachineAction> {
  const actions: Array<ScheduledMachineAction> = [];

  for (const declaration of declarations) {
    const matches = existing.filter((machine) => machine.name === declaration.name);
    const kept = matches.find((machine) => machine.image === image) ?? matches[0];

    if (kept === undefined) {
      actions.push({ image, kind: 'create', machine: declaration });
      continue;
    }

    if (kept.image !== image) {
      actions.push({ image, kind: 'update-image', machine: declaration, machineID: kept.id });
    }

    // a replace that created its new machine but never destroyed the old one leaves two machines
    // with one declared name, and both would run the schedule
    for (const extra of matches) {
      if (extra !== kept) {
        actions.push({ kind: 'destroy', machineID: extra.id });
      }
    }
  }

  return actions;
}
