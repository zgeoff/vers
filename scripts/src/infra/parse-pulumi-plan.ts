import { z } from 'zod';
import type { PulumiPlan } from './types';

const stepSchema = z.object({ op: z.string(), urn: z.string() });
const diagnosticSchema = z.object({ severity: z.string(), message: z.string() });

const planSchema = z.object({
  steps: z.array(stepSchema).default([]),
  diagnostics: z.array(diagnosticSchema).default([]),
  changeSummary: z.record(z.string(), z.number()).default({}),
});

// the JSON that `pulumi preview --json` prints; undefined for any other text
export function parsePulumiPlan(text: string): PulumiPlan | undefined {
  const json = parseJSON(text);
  const result = planSchema.safeParse(json);

  return result.success ? result.data : undefined;
}

function parseJSON(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);

    return value;
  } catch {
    return undefined;
  }
}
