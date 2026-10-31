import type { FlyMachine, MachineFleet } from './types';

interface WakeOptions {
  readonly timeoutMs: number;
  readonly pollIntervalMs: number;
}

type WakeOutcome = 'started' | 'timed-out';

export async function wakeMachines(
  fleet: MachineFleet,
  options: Readonly<WakeOptions>,
): Promise<WakeOutcome> {
  const before = await fleet.list();

  for (const machine of before.filter((candidate) => candidate.state !== 'started')) {
    await fleet.start(machine.id);
  }

  const deadline = Date.now() + options.timeoutMs;

  let machines = await fleet.list();

  while (!isEveryMachineStarted(machines)) {
    if (Date.now() >= deadline) {
      return 'timed-out';
    }

    await Bun.sleep(options.pollIntervalMs);

    machines = await fleet.list();
  }

  return 'started';
}

function isEveryMachineStarted(machines: ReadonlyArray<FlyMachine>): boolean {
  return machines.length > 0 && machines.every((machine) => machine.state === 'started');
}
