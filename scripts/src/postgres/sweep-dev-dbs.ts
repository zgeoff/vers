import postgres from 'postgres';
import { pickOrphanedDevDBs } from './pick-orphaned-dev-dbs';

interface SweepConfig {
  branches: ReadonlyArray<string>;
  machine: string;
  maintenanceDSN: string;
}

/**
 * Drops this machine's orphaned dev databases and returns their names.
 */
export async function sweepDevDBs(config: Readonly<SweepConfig>): Promise<Array<string>> {
  const pg = postgres(config.maintenanceDSN, { max: 1 });

  try {
    const rows = await pg<Array<{ datname: string }>>`
      SELECT datname FROM pg_database WHERE datname LIKE ${String.raw`dev\_%`}
    `;

    const dbNames = rows.map((row) => row.datname);

    const orphans = pickOrphanedDevDBs({
      branches: config.branches,
      dbNames,
      machine: config.machine,
    });

    for (const name of orphans) {
      // WITH (FORCE) disconnects lingering sessions first, so the drop never fails on a stale
      // connection left by a closed agent session.
      await pg.unsafe(`DROP DATABASE ${name} WITH (FORCE)`);
    }

    return orphans;
  } finally {
    await pg.end();
  }
}
