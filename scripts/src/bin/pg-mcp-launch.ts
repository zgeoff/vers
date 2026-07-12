import { writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { buildDevDBName } from '../postgres/build-dev-db-name';
import { buildDevDSN } from '../postgres/build-dev-dsn';
import { readVaultDSN } from '../postgres/read-vault-dsn';
import { renderDBHubTOML } from '../postgres/render-dbhub-toml';

/**
 * MCP stdio entrypoint (.mcp.json): renders a per-session dbhub config — the
 * dev source pinned to this worktree's database — then hands stdio over to
 * dbhub. Everything here runs before any tool call, so it must stay cheap and
 * local: DSN reads hit 1Password, never Neon.
 */
async function launchPostgresMCP() {
  const branchResult = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

  const branch = branchResult.stdout.trim();
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

  const result = await execa(dbhubBin, ['--transport', 'stdio', '--config', configPath], {
    reject: false,
    stdio: 'inherit',
  });

  process.exit(result.exitCode ?? 1);
}

try {
  await launchPostgresMCP();
} catch (error) {
  console.error('❌ failed to launch postgres MCP');
  console.error(error);
  process.exit(1);
}
