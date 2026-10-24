import { z } from 'zod';
import type { AuditAdvisory } from './types';

const advisorySchema = z.object({ id: z.number(), url: z.string() });
const auditReportSchema = z.record(z.string(), z.array(advisorySchema));

export function parseAuditReport(output: string): Array<AuditAdvisory> {
  const report = auditReportSchema.parse(JSON.parse(output));

  return Object.entries(report).flatMap(([packageName, advisories]) =>
    advisories.map((advisory) => ({
      advisoryIDs: [String(advisory.id), ...advisory.url.split('/').slice(-1)],
      packageName,
    })),
  );
}
