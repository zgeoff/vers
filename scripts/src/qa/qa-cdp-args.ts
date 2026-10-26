import type { Args } from 'gunshi';
import { parseSeconds } from '../utils/parse-seconds';
import { ENDPOINT_ARG } from './endpoint-arg';

const DEFAULT_CONSOLE_SECONDS = 10;
const DEFAULT_PROFILE_SECONDS = 4;
const DEFAULT_MONITOR_SECONDS = 10;
const TARGET_ARG = { description: 'target id', type: 'positional' } as const;
const PAGE_TARGET_ARG = { description: 'page target id', type: 'positional' } as const;

// gunshi fills the positional arguments in the order their keys appear, so each command lists
// them in the order they are typed.
export const QA_CDP_ARGS = {
  targets: { endpoint: ENDPOINT_ARG },
  new: {
    endpoint: ENDPOINT_ARG,
    url: { default: 'about:blank', description: 'url to open', type: 'positional' },
    context: {
      description: 'open the tab in this browser context instead of a fresh one',
      metavar: 'id',
      type: 'string',
    },
  },
  ctx: { endpoint: ENDPOINT_ARG, target: TARGET_ARG },
  close: { endpoint: ENDPOINT_ARG, target: TARGET_ARG },
  procs: { endpoint: ENDPOINT_ARG },
  monitor: {
    endpoint: ENDPOINT_ARG,
    every: {
      default: DEFAULT_MONITOR_SECONDS,
      description: 'seconds between polls',
      metavar: 'seconds',
      parse: parseSeconds,
      type: 'custom',
    },
    url: {
      description: 'poll only targets whose url contains this',
      metavar: 'substring',
      type: 'string',
    },
  },
  nav: {
    endpoint: ENDPOINT_ARG,
    target: PAGE_TARGET_ARG,
    url: { description: 'url to open', type: 'positional' },
  },
  reload: { endpoint: ENDPOINT_ARG, target: PAGE_TARGET_ARG },
  eval: {
    endpoint: ENDPOINT_ARG,
    target: TARGET_ARG,
    script: {
      description: 'script to evaluate; a page also has the window.__qa helpers',
      type: 'positional',
    },
  },
  text: { endpoint: ENDPOINT_ARG, target: PAGE_TARGET_ARG },
  shot: {
    endpoint: ENDPOINT_ARG,
    target: PAGE_TARGET_ARG,
    file: { description: 'png path to write', type: 'positional' },
  },
  type: {
    endpoint: ENDPOINT_ARG,
    target: PAGE_TARGET_ARG,
    selector: { description: 'css selector of the element to focus', type: 'positional' },
    text: { description: 'text to type', type: 'positional' },
  },
  insert: {
    endpoint: ENDPOINT_ARG,
    target: PAGE_TARGET_ARG,
    selector: { description: 'css selector of the element to focus', type: 'positional' },
    text: { description: 'text to insert', type: 'positional' },
  },
  key: {
    endpoint: ENDPOINT_ARG,
    target: PAGE_TARGET_ARG,
    key: { description: 'key name', type: 'positional' },
  },
  click: {
    endpoint: ENDPOINT_ARG,
    target: PAGE_TARGET_ARG,
    x: { description: 'x in css pixels', parse: parseCoordinate, type: 'positional' },
    y: { description: 'y in css pixels', parse: parseCoordinate, type: 'positional' },
  },
  console: {
    endpoint: ENDPOINT_ARG,
    target: TARGET_ARG,
    seconds: {
      default: DEFAULT_CONSOLE_SECONDS,
      description: 'seconds to collect',
      metavar: 'n',
      parse: parseSeconds,
      type: 'custom',
    },
    reload: {
      default: false,
      description: 'reload the page once collection starts',
      type: 'boolean',
    },
  },
  offline: {
    endpoint: ENDPOINT_ARG,
    target: TARGET_ARG,
    state: { description: 'on or off', parse: parseSwitchState, type: 'positional' },
  },
  pause: { endpoint: ENDPOINT_ARG, target: TARGET_ARG },
  profile: {
    endpoint: ENDPOINT_ARG,
    target: TARGET_ARG,
    seconds: {
      default: DEFAULT_PROFILE_SECONDS,
      description: 'seconds to sample',
      metavar: 'n',
      parse: parseSeconds,
      type: 'custom',
    },
  },
} as const satisfies Record<string, Args>;

function parseCoordinate(value: string): number {
  const coordinate = Number(value);

  if (value.trim() === '' || !Number.isFinite(coordinate)) {
    throw new Error(`expected a number, got "${value}"`);
  }

  return coordinate;
}

function parseSwitchState(value: string): 'on' | 'off' {
  if (value !== 'on' && value !== 'off') {
    throw new Error(`expected on or off, got "${value}"`);
  }

  return value;
}
