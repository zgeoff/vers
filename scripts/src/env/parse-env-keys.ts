const ASSIGNMENT_PATTERN = /^\s*(?:export\s+)?(?<key>[A-Za-z_][A-Za-z0-9_]*)\s*=/;

/**
 * Collects the variable names a dotenv-format file assigns, ignoring comments, blank lines, and
 * every value — callers compare key coverage, never values.
 */
export function parseEnvKeys(source: string): Array<string> {
  const keys: Array<string> = [];

  for (const line of source.split('\n')) {
    const key = ASSIGNMENT_PATTERN.exec(line)?.groups?.['key'];

    if (key !== undefined) {
      keys.push(key);
    }
  }

  return keys;
}
