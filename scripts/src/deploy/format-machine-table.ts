import type { AppMachine } from './types';

export function formatMachineTable(machines: ReadonlyArray<AppMachine>): string {
  const rows = machines.map((machine) => ({
    gitSHA: machine.gitSHA ?? '-',
    id: machine.id,
    image: machine.image ?? '-',
    state: machine.state,
  }));

  const idWidth = Math.max(0, ...rows.map((row) => row.id.length));
  const stateWidth = Math.max(0, ...rows.map((row) => row.state.length));
  const imageWidth = Math.max(0, ...rows.map((row) => row.image.length));

  return rows
    .map(
      (row) =>
        `${row.id.padEnd(idWidth)}  ${row.state.padEnd(stateWidth)}  ${row.image.padEnd(imageWidth)}  ${row.gitSHA}`,
    )
    .join('\n');
}
