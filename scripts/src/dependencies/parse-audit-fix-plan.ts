import { z } from 'zod';

const plannedPackageSchema = z.object({ name: z.string() });
const plannedPackagesSchema = z.array(plannedPackageSchema);

const auditFixPlanSchema = z.object({
  fixes: plannedPackagesSchema,
  blocked: plannedPackagesSchema,
  unfixable: plannedPackagesSchema,
});

export function parseAuditFixPlan(output: string): Array<string> {
  const plan = auditFixPlanSchema.parse(JSON.parse(output));

  const stuck = new Set([...plan.blocked, ...plan.unfixable].map((entry) => entry.name));

  const fixable = plan.fixes.map((fix) => fix.name).filter((name) => !stuck.has(name));

  return [...new Set(fixable)];
}
