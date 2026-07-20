import { parse } from '@dotenvx/dotenvx';

/**
 * Collects the variable names a dotenv-format file assigns — callers compare key coverage, never
 * values. The dotenv grammar tracks quote state, so an assignment-shaped line inside a quoted
 * multiline value never reads as a key.
 */
export function parseEnvKeys(source: string): Array<string> {
  return Object.keys(parse(source));
}
