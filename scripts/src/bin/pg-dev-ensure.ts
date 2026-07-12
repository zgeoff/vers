import { hostname } from 'node:os';
import { execa } from 'execa';
import { createDevDB } from '../postgres/create-dev-db';
import { readVaultDSN } from '../postgres/read-vault-dsn';

/**
 * Runs as the dev source's init_command: dbhub invokes it before the first
 * connection of a session, with cwd inherited from the worktree. stdout is
 * captured and relayed to dbhub's stderr log.
 */
async function ensureDevDB() {
  const dbName = process.argv.at(2);

  if (dbName === undefined) {
    throw new Error('usage: pg-dev-ensure.ts <dbName>');
  }

  const branchResult = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const maintenanceDSN = await readVaultDSN('neon-mcp-dev');

  await createDevDB({
    branch: branchResult.stdout.trim(),
    dbName,
    machine: hostname(),
    maintenanceDSN,
  });

  console.log(`dev database ${dbName} ready`);
}

try {
  await ensureDevDB();
} catch (error) {
  console.error('❌ dev database provisioning failed');
  console.error(error);
  process.exit(1);
}
