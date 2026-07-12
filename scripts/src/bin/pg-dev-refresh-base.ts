import { readVaultDSN } from '../postgres/read-vault-dsn';
import { refreshDevBase } from '../postgres/refresh-dev-base';

async function refreshBase() {
  const maintenanceDSN = await readVaultDSN('neon-mcp-dev');

  await refreshDevBase(maintenanceDSN, process.cwd());

  console.log('dev_base refreshed');
}

try {
  await refreshBase();
} catch (error) {
  console.error('❌ dev_base refresh failed');
  console.error(error);
  process.exit(1);
}
