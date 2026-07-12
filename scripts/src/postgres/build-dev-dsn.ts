/**
 * Swaps the database name in a postgres DSN, preserving credentials, host,
 * and query parameters.
 */
export function buildDevDSN(baseDSN: string, dbName: string): string {
  const url = new URL(baseDSN);

  url.pathname = `/${dbName}`;

  return url.toString();
}
