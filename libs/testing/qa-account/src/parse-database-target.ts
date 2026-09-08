import type { DatabaseTarget } from './types';

const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['127.0.0.1', '::1', '[::1]', 'localhost']);

export function parseDatabaseTarget(databaseURL: string): DatabaseTarget {
  const url = URL.parse(databaseURL);

  if (url === null) {
    throw new Error('DATABASE_URL is not a valid URL');
  }

  const hostname = url.hostname.toLowerCase();

  return {
    host: url.host,
    isLoopback: LOOPBACK_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost'),
  };
}
