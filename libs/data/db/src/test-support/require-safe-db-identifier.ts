// CREATE DATABASE and DROP DATABASE cannot parameterize an identifier, so the name is interpolated
// raw and must already be a safe identifier
export function requireSafeDBIdentifier(name: string): void {
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`invalid database identifier: ${name}`);
  }
}
