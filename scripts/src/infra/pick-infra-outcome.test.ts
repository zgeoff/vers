import { expect, test } from 'bun:test';
import { pickInfraOutcome } from './pick-infra-outcome';
import type { InfraOutcome } from './types';

test.each<[string, Array<string>, InfraOutcome]>([
  ['push', [], 'apply'],
  ['push', ['delete urn:pulumi:prod::vers-infra::neon:index/role:Role::app'], 'held'],
  ['workflow_dispatch', [], 'apply'],
  ['workflow_dispatch', ['delete urn:pulumi:prod::vers-infra::neon:index/role:Role::app'], 'apply'],
])('it picks the outcome of a %s run with holds %j as %s', (event, holds, outcome) => {
  expect(pickInfraOutcome({ event, holds })).toBe(outcome);
});
