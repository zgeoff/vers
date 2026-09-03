import type { EnvContract } from './types';

export function renderEnvContract(contract: EnvContract): string {
  const optional = renderKeyList(contract.optional);
  const required = renderKeyList(contract.required);

  return `{\n  "optional": ${optional},\n  "required": ${required}\n}\n`;
}

function renderKeyList(keys: ReadonlyArray<string>): string {
  const rendered = keys.map((key) => JSON.stringify(key)).join(', ');

  return `[${rendered}]`;
}
