export function buildDevDSN(baseDSN: string, dbName: string): string {
  const url = new URL(baseDSN);

  url.pathname = `/${dbName}`;

  return url.toString();
}
