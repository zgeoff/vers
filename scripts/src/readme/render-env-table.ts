import type { EnvRow } from './types';

interface RenderEnvTableConfig {
  /**
   * Rows sourced from an `.env.example` carry no presence information — the column is dropped
   * rather than rendered empty.
   */
  readonly includePresence: boolean;
}

/**
 * Columns are padded to their widest cell, matching the formatter's markdown table style so a
 * freshly generated table is format-stable.
 */
export function renderEnvTable(
  rows: ReadonlyArray<EnvRow>,
  config: Readonly<RenderEnvTableConfig>,
): string {
  const header = config.includePresence
    ? ['Variable', 'Presence', 'Description']
    : ['Variable', 'Description'];

  const body = rows.map((row) => {
    const cells = [`\`${row.key}\``];

    if (config.includePresence) {
      cells.push(formatPresence(row));
    }

    const description = row.description === '' ? '—' : row.description;

    cells.push(description);

    return cells;
  });

  const widths = header.map((cell, column) =>
    Math.max(cell.length, ...body.map((cells) => cells[column]?.length ?? 0)),
  );

  const lines = [
    renderRow(header, widths),
    renderRow(
      widths.map((width) => '-'.repeat(width)),
      widths,
    ),
    ...body.map((cells) => renderRow(cells, widths)),
  ];

  return lines.join('\n');
}

function renderRow(cells: ReadonlyArray<string>, widths: ReadonlyArray<number>): string {
  const padded = cells.map((cell, column) => cell.padEnd(widths[column] ?? 0));

  return `| ${padded.join(' | ')} |`;
}

function formatPresence(row: EnvRow): string {
  if (row.defaultValue !== undefined) {
    return `default \`${row.defaultValue}\``;
  }

  return row.required ? 'required' : 'optional';
}
