interface DBHubTOMLConfig {
  devDSN: string;
  ensureCommand: string;
  prodDSN: string;
}

/**
 * Both sources are lazy, so a session that never queries postgres never opens
 * a connection and Neon compute stays suspended; the dev source's
 * init_command provisions its database on first use. With two sources, dbhub
 * exposes the tools per source as execute_sql_prod / execute_sql_dev /
 * search_objects_prod / search_objects_dev.
 */
export function renderDBHubTOML(config: Readonly<DBHubTOMLConfig>): string {
  return `[[sources]]
id = "prod"
description = "vers production (Neon main branch) — read-only"
dsn = ${JSON.stringify(config.prodDSN)}
lazy = true

[[sources]]
id = "dev"
description = "disposable per-worktree dev database (Neon dev branch) — full read/write"
dsn = ${JSON.stringify(config.devDSN)}
lazy = true
init_command = ${JSON.stringify(config.ensureCommand)}

[[tools]]
name = "execute_sql"
source = "prod"
readonly = true
max_rows = 500

[[tools]]
name = "execute_sql"
source = "dev"
max_rows = 1000

[[tools]]
name = "search_objects"
source = "prod"

[[tools]]
name = "search_objects"
source = "dev"
`;
}
