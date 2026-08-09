import type { AppMachine } from './types';

/**
 * Renders one column-aligned line per machine — id, state, image, git SHA — for an operator reading
 * a sweep-ambiguity failure. A missing image or git SHA prints as `-`.
 */
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
