import type { EnvContract } from './types';

/**
 * Renders a derived env contract as the committed `env-contract.generated.json` text: two-space
 * indent with single-line key arrays, matching the repo formatter's JSON style so a fresh write
 * and a formatted artifact agree byte-for-byte at today's key counts.
 */
export function renderEnvContract(contract: EnvContract): string {
  const optional = renderKeyList(contract.optional);
  const required = renderKeyList(contract.required);

  return `{\n  "optional": ${optional},\n  "required": ${required}\n}\n`;
}

function renderKeyList(keys: ReadonlyArray<string>): string {
  const rendered = keys.map((key) => JSON.stringify(key)).join(', ');

  return `[${rendered}]`;
}
