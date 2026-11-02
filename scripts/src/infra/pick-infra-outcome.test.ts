import { expect, test } from 'bun:test';
import { pickInfraOutcome } from './pick-infra-outcome';
import type { InfraOutcome } from './types';

test.each<[string, Array<string>, boolean, InfraOutcome]>([
  ['push', [], true, 'apply'],
  ['push', [], false, 'apply'],
  ['push', ['delete urn:pulumi:prod::vers-infra::neon:index/role:Role::app'], true, 'held'],
  ['workflow_dispatch', [], true, 'apply'],
  [
    'workflow_dispatch',
    ['delete urn:pulumi:prod::vers-infra::neon:index/role:Role::app'],
    true,
    'apply',
  ],
  [
    'workflow_dispatch',
    ['delete urn:pulumi:prod::vers-infra::neon:index/role:Role::app'],
    false,
    'held',
  ],
])(
  'it picks the outcome of a %s run with holds %j and main-tip %s as %s',
  (event, holds, isMainTip, outcome) => {
    expect(pickInfraOutcome({ event, holds, isMainTip })).toBe(outcome);
  },
);
