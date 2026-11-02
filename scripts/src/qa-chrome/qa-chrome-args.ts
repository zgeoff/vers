import type { Args } from 'gunshi';

const DEFAULT_PORT = 9222;
const MAX_PORT = 65_535;

export const QA_CHROME_ARGS = {
  start: {
    netns: {
      default: false,
      description: 'run the browser in its own network namespace, which qa:net cuts and restores',
      type: 'boolean',
    },
    port: {
      default: DEFAULT_PORT,
      description: 'DevTools port on 127.0.0.1',
      metavar: 'port',
      parse: parsePort,
      type: 'custom',
    },
  },
  stop: {},
} as const satisfies Record<string, Args>;

function parsePort(value: string): number {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(`expected a port from 1 to ${MAX_PORT}, got "${value}"`);
  }

  return port;
}
