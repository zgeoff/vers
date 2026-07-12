import { hostname } from 'node:os';
import { readLocalBranches } from '../postgres/read-local-branches';
import { readVaultDSN } from '../postgres/read-vault-dsn';
import { sweepDevDBs } from '../postgres/sweep-dev-dbs';

async function sweepDevDatabases() {
  const maintenanceDSN = await readVaultDSN('neon-mcp-dev');
  const branches = await readLocalBranches(process.cwd());
  const dropped = await sweepDevDBs({ branches, machine: hostname(), maintenanceDSN });

  const summary =
    dropped.length === 0
      ? 'no orphaned dev databases for this machine'
      : `dropped ${dropped.length} orphaned dev database(s): ${dropped.join(', ')}`;

  console.log(summary);
}

try {
  await sweepDevDatabases();
} catch (error) {
  console.error('❌ sweep failed');
  console.error(error);
  process.exit(1);
}
