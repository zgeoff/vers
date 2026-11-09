import type { HostTarget } from './types';

const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['127.0.0.1', '::1', '[::1]', 'localhost']);

export function parseHostTarget(label: string, rawURL: string): HostTarget {
  const url = URL.parse(rawURL);

  if (url === null) {
    throw new Error(`${label} is not a valid URL`);
  }

  const hostname = url.hostname.toLowerCase();

  return {
    host: url.host,
    isLoopback: LOOPBACK_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost'),
  };
}
