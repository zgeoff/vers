import { readLocalBranches } from '../postgres/read-local-branches';
import { sweepTestTemplates } from '../postgres/sweep-test-templates';

const TEST_CONTAINER_BASE_URI = 'postgres://test:test@localhost:32999';

async function sweepTestTemplateDatabases() {
  const branches = await readLocalBranches(process.cwd());
  const dropped = await sweepTestTemplates({ baseURI: TEST_CONTAINER_BASE_URI, branches });

  if (dropped === null) {
    console.log('test container is not running — skipping sweep');

    return;
  }

  const summary =
    dropped.length === 0
      ? 'no orphaned test-template databases'
      : `dropped ${dropped.length} orphaned test-template database(s): ${dropped.join(', ')}`;

  console.log(summary);
}

try {
  await sweepTestTemplateDatabases();
} catch (error) {
  console.error('❌ sweep failed');
  console.error(error);
  process.exit(1);
}
