/**
 * Guards a `CREATE DATABASE`/`DROP DATABASE` statement, which can't
 * parameterize an identifier: `name` may come straight from an env override
 * or caller-supplied config, so this rejects anything that isn't already a
 * safe identifier rather than trusting the caller.
 */
export function requireSafeDBIdentifier(name: string): void {
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`invalid database identifier: ${name}`);
  }
}
