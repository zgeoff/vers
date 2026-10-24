import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { DEPLOY_BOUNDS } from './deploy-bounds';

test('it interrupts flyctl only after its own wait and the probes could have run', () => {
  expect(DEPLOY_BOUNDS.waitTimeoutMinutes + DEPLOY_BOUNDS.probeBudgetMinutes).toBeLessThan(
    DEPLOY_BOUNDS.interruptAfterMinutes,
  );
});

test('it ends an interrupted flyctl before the deploy job timeout', async () => {
  const workflowText = await Bun.file(
    join(import.meta.dir, '../../../.github/workflows/main.yml'),
  ).text();

  const deployJob = z.object({ 'timeout-minutes': z.number() });
  const workflow = z.object({ jobs: z.object({ deploy: deployJob }) }).parse(parse(workflowText));

  expect(DEPLOY_BOUNDS.interruptAfterMinutes + DEPLOY_BOUNDS.interruptGraceMinutes).toBeLessThan(
    workflow.jobs.deploy['timeout-minutes'],
  );
});
