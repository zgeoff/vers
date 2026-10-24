import { z } from 'zod';

const fixSchema = z.object({ name: z.string() });
const auditFixPlanSchema = z.object({ fixes: z.array(fixSchema) });

export function parseAuditFixPlan(output: string): Array<string> {
  return auditFixPlanSchema.parse(JSON.parse(output)).fixes.map((fix) => fix.name);
}
