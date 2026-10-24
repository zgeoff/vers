import { writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from 'bun';
import { buildDevDBName } from '../postgres/build-dev-db-name';
import { buildDevDSN } from '../postgres/build-dev-dsn';
import { readVaultDSN } from '../postgres/read-vault-dsn';
import { renderDBHubTOML } from '../postgres/render-dbhub-toml';
import { bindToParent } from '../utils/bind-to-parent';

async function runPostgresMCP() {
  const branchOutput = await $`git rev-parse --abbrev-ref HEAD`.text();

  const branch = branchOutput.trim();
  const dbName = buildDevDBName(hostname(), branch);

  const [prodDSN, devBranchDSN] = await Promise.all([
    readVaultDSN('neon-mcp-ro'),
    readVaultDSN('neon-mcp-dev'),
  ]);

  const ensureBin = fileURLToPath(new URL('pg-dev-ensure.ts', import.meta.url));

  const toml = renderDBHubTOML({
    devDSN: buildDevDSN(devBranchDSN, dbName),
    ensureCommand: `bun ${ensureBin} ${dbName}`,
    prodDSN,
  });

  const configPath = join(process.env['XDG_RUNTIME_DIR'] ?? tmpdir(), `vers-dbhub-${dbName}.toml`);

  writeFileSync(configPath, toml, { mode: 0o600 });

  const dbhubBin = fileURLToPath(new URL('../../node_modules/.bin/dbhub', import.meta.url));

  const dbhub = Bun.spawn([dbhubBin, '--transport', 'stdio', '--config', configPath], {
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  bindToParent(dbhub);

  const exitCode = await dbhub.exited;

  process.exit(exitCode);
}

try {
  await runPostgresMCP();
} catch (error) {
  console.error('❌ failed to launch postgres MCP');
  console.error(error);
  process.exit(1);
}
