import { z } from 'zod';
import type { WorkflowJob } from './types';

const EXPRESSION_WRAPPER = /^\$\{\{(?<expression>[\s\S]*)\}\}$/u;
const concurrencySchema = z.object({ 'cancel-in-progress': z.boolean().optional() });
const needsSchema = z.union([z.string(), z.array(z.string())]);

const jobSchema = z.object({
  needs: needsSchema.optional(),
  if: z.union([z.string(), z.boolean()]).optional(),
  concurrency: z.union([z.string(), concurrencySchema]).optional(),
});

const workflowJobsSchema = z
  .object({ jobs: z.record(z.string(), jobSchema) })
  .transform(
    (workflow) =>
      new Map(Object.entries(workflow.jobs).map(([name, job]) => [name, toWorkflowJob(job)])),
  );

export function parseWorkflowJobs(document: unknown) {
  return workflowJobsSchema.safeParse(document);
}

function toWorkflowJob(job: z.infer<typeof jobSchema>): WorkflowJob {
  const needs = typeof job.needs === 'string' ? [job.needs] : (job.needs ?? []);

  const cancelsInProgress =
    typeof job.concurrency === 'object' && job.concurrency['cancel-in-progress'] === true;

  return { needs, condition: toCondition(job.if), cancelsInProgress };
}

function toCondition(value: string | boolean | undefined): string {
  // a job with no `if:` runs under GitHub's default success() check
  if (value === undefined) {
    return 'success()';
  }

  const text = String(value).trim();

  return (EXPRESSION_WRAPPER.exec(text)?.groups?.['expression'] ?? text).trim();
}
