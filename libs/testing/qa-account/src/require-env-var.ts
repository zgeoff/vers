export function requireEnvVar(name: string, reason: string): string {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(`${name} must be set — ${reason}`);
  }

  return value;
}
