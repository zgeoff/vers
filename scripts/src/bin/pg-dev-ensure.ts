import { hostname } from 'node:os';
import { execa } from 'execa';
import { createDevDB as createDevDBClone } from '../postgres/create-dev-db';
import { readVaultDSN } from '../postgres/read-vault-dsn';

async function createDevDB() {
  const dbName = process.argv.at(2);

  if (dbName === undefined) {
    throw new Error('usage: pg-dev-ensure.ts <dbName>');
  }

  const branchResult = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const maintenanceDSN = await readVaultDSN('neon-mcp-dev');

  await createDevDBClone({
    branch: branchResult.stdout.trim(),
    dbName,
    machine: hostname(),
    maintenanceDSN,
  });

  console.log(`dev database ${dbName} ready`);
}

try {
  await createDevDB();
} catch (error) {
  console.error('❌ dev database provisioning failed');
  console.error(error);
  process.exit(1);
}
