import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { BUILD_BOUNDS } from './build-bounds';

test('it fits the stall windows of both build attempts inside the build step timeout', async () => {
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

test('it times out every build job step, checkout retry included, before the build job times out', async () => {
  const workflowText = await Bun.file(
    join(import.meta.dir, '../../../.github/workflows/main.yml'),
  ).text();

  const step = z.object({ name: z.string(), 'timeout-minutes': z.number() });
  const buildJob = z.object({ 'timeout-minutes': z.number(), steps: z.array(step) });
  const workflow = z.object({ jobs: z.object({ build: buildJob }) }).parse(parse(workflowText));

  const stepMinutes = workflow.jobs.build.steps.reduce(
    (total, candidate) => total + candidate['timeout-minutes'],
    0,
  );

  expect(stepMinutes).toBeLessThan(workflow.jobs.build['timeout-minutes']);
});
