import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { BUILD_BOUNDS } from './build-bounds';

test('it ends every stalled build attempt before the build step times out', async () => {
  const workflowText = await Bun.file(
    join(import.meta.dir, '../../../.github/workflows/main.yml'),
  ).text();

  const step = z.object({ name: z.string(), 'timeout-minutes': z.number() });
  const buildJob = z.object({ 'timeout-minutes': z.number(), steps: z.array(step) });
  const workflow = z.object({ jobs: z.object({ build: buildJob }) }).parse(parse(workflowText));

  const [buildStep] = z
    .tuple([step])
    .parse(workflow.jobs.build.steps.filter((candidate) => candidate.name.startsWith('Build ')));

  expect(
    BUILD_BOUNDS.attempts * (BUILD_BOUNDS.stallAfterSeconds + BUILD_BOUNDS.stallGraceSeconds),
  ).toBeLessThan(buildStep['timeout-minutes'] * 60);
});

test('it fails a timed-out build step before the build job times out', async () => {
  const workflowText = await Bun.file(
    join(import.meta.dir, '../../../.github/workflows/main.yml'),
  ).text();

  const step = z.object({ name: z.string(), 'timeout-minutes': z.number() });
  const buildJob = z.object({ 'timeout-minutes': z.number(), steps: z.array(step) });
  const workflow = z.object({ jobs: z.object({ build: buildJob }) }).parse(parse(workflowText));

  const [buildStep] = z
    .tuple([step])
    .parse(workflow.jobs.build.steps.filter((candidate) => candidate.name.startsWith('Build ')));

  expect(buildStep['timeout-minutes']).toBeLessThan(workflow.jobs.build['timeout-minutes']);
});
