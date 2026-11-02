import type { PulumiPlan } from './types';

// a refresh changes no resource, and read is a data source; any other op, one that a later Pulumi
// adds included, holds the apply
const unattendedOps = new Set(['same', 'create', 'update', 'read', 'refresh']);

export function collectPlanHolds(plan: Readonly<PulumiPlan>): Array<string> {
  const stepHolds = plan.steps.filter((step) => !unattendedOps.has(step.op));

  const heldOps = new Set(stepHolds.map((step) => step.op));

  const summaryHolds = Object.entries(plan.changeSummary).filter(
    ([op, count]) => !unattendedOps.has(op) && !heldOps.has(op) && count > 0,
  );

  return [
    ...stepHolds.map((step) => `${step.op} ${step.urn}`),
    ...summaryHolds.map(([op, count]) => `the plan's summary counts ${count} ${op}`),
  ];
}
