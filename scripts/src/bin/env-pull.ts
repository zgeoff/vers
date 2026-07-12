import path from 'node:path';
import { ENV_FILE_MANIFEST } from '../env/manifest';
import { parseNotesPlain } from '../env/parse-notes-plain';
import { planEnvWrites } from '../env/plan-env-writes';
import { readOpItem } from '../env/read-op-item';
import { writeEnvFile } from '../env/write-env-file';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const plans = planEnvWrites(ENV_FILE_MANIFEST, repoRoot);
let failed = false;

for (const plan of plans) {
  try {
    const raw = await readOpItem(plan.itemTitle, plan.vault);

    const notes = parseNotesPlain(raw, plan.itemTitle);

    await writeEnvFile(plan.filePath, notes);

    console.log(`wrote ${path.relative(repoRoot, plan.filePath)}`);
  } catch (error) {
    failed = true;

    console.error(
      `✗ ${plan.itemTitle} — ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

if (failed) {
  process.exitCode = 1;
}
