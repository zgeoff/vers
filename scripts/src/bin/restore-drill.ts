import { createDB } from '@vers/db';
import { z } from 'zod';
import { formatRestoreDrillReport } from '../restore-drill/format-restore-drill-report';
import { readRestoreDrillChecks } from '../restore-drill/read-restore-drill-checks';

const envSchema = z.object({ RESTORE_DRILL_DATABASE_URL: z.string().min(1) });

async function runRestoreDrill(): Promise<number> {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      '❌ RESTORE_DRILL_DATABASE_URL must hold the connection string of the restored branch',
    );

    return 1;
  }

  const db = createDB({ databaseURL: parsed.data.RESTORE_DRILL_DATABASE_URL });
  const startedAt = performance.now();

  const checks = await readRestoreDrillChecks(db).finally(() => db.destroy());

  const elapsedMs = Math.round(performance.now() - startedAt);

  console.log(formatRestoreDrillReport(checks));
  console.log(`checks ran in ${elapsedMs} ms`);

  return checks.some((check) => check.violations.length > 0) ? 1 : 0;
}

try {
  process.exitCode = await runRestoreDrill();
} catch (error) {
  console.error('❌ the restore drill could not read the restored branch');
  console.error(error);

  process.exitCode = 1;
}
