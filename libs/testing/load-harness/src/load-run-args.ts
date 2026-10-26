import { parseIntegerOption } from '@vers/scripts';
import type { Args } from 'gunshi';

export const LOAD_RUN_ARGS = {
  scenario: {
    choices: ['all', 'steady', 'offline-return', 'recovery'],
    default: 'all',
    description: 'the scenario to run; all runs the steady ramp, the offline return, then recovery',
    type: 'enum',
  },
  'steady-players': {
    default: '50,100,200,400,800',
    description: 'connected players at each step of the steady ramp, comma-separated',
    metavar: 'n,n',
    type: 'string',
  },
  'steady-minutes': {
    default: 3,
    description: 'minutes of play at each steady step',
    metavar: 'n',
    parse: (value: string) => parseIntegerOption(value, 1),
    type: 'custom',
  },
  'offline-players': {
    default: 50,
    description: 'players who return from the same gap at the same moment',
    metavar: 'n',
    parse: (value: string) => parseIntegerOption(value, 1),
    type: 'custom',
  },
  'offline-hours': {
    default: 8,
    description: 'hours each returning player was away, up to the offline cap',
    metavar: 'n',
    parse: (value: string) => parseIntegerOption(value, 1),
    type: 'custom',
  },
  'recovery-players': {
    default: 50,
    description: 'connected players through the dependency outage',
    metavar: 'n',
    parse: (value: string) => parseIntegerOption(value, 1),
    type: 'custom',
  },
  'outage-service': {
    choices: ['service-keys', 'service-replay', 'service-replay-retained'],
    default: 'service-keys',
    description: 'the dependency the recovery scenario stops',
    type: 'enum',
  },
  'outage-minutes': {
    default: 2,
    description: 'minutes the dependency stays down',
    metavar: 'n',
    parse: (value: string) => parseIntegerOption(value, 1),
    type: 'custom',
  },
  'retained-every': {
    default: 4,
    description: 'every nth player stamps the retained sim version',
    metavar: 'n',
    parse: (value: string) => parseIntegerOption(value, 1),
    type: 'custom',
  },
  'settlement-target-seconds': {
    default: 30,
    description: 'the settlement age p95 a steady step must meet to count as supported',
    metavar: 'n',
    parse: (value: string) => parseIntegerOption(value, 1),
    type: 'custom',
  },
  'cpu-profile': {
    choices: ['burst', 'baseline'],
    default: 'burst',
    description:
      "each service container's CPU: a whole CPU, as a shared Fly machine bursts, or its sustained baseline quota",
    type: 'enum',
  },
  'skip-build': {
    default: false,
    description: 'reuse the images an earlier run built for this commit',
    type: 'boolean',
  },
} as const satisfies Args;
