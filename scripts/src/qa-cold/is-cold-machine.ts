const COLD_STATES: ReadonlySet<string> = new Set(['stopped', 'suspended']);

interface MachineStateProbe {
  readonly state: string;
}

export function isColdMachine(machine: MachineStateProbe): boolean {
  return COLD_STATES.has(machine.state);
}
