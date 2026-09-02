import { parse } from '@dotenvx/dotenvx';

export function parseEnvKeys(source: string): Array<string> {
  return Object.keys(parse(source));
}
