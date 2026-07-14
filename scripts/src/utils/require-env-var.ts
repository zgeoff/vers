/**
 * Reads a required environment variable, throwing a clear error naming both
 * the variable and why it's needed when it's unset or empty.
 */
export function requireEnvVar(name: string, reason: string): string {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(`${name} must be set — ${reason}`);
  }

  return value;
}
