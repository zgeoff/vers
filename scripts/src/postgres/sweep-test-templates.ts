import { isTestContainerReachable } from '@vers/db/test-support';
import postgres from 'postgres';
import { pickOrphanedTestTemplates } from './pick-orphaned-test-templates';

interface SweepTestTemplatesConfig {
  readonly baseURI: string;
  readonly branches: ReadonlyArray<string>;
}

/**
 * Drops the local test container's orphaned branch-scoped test-template
 * databases and returns their names, or `null` when the container isn't
 * reachable — a sweep is a no-op on a machine with no running test
 * container. `DROP ... WITH (FORCE)` disconnects lingering sessions first,
 * so a sweep never fails on a connection a closed test run left open.
 */
export async function sweepTestTemplates(
  config: Readonly<SweepTestTemplatesConfig>,
): Promise<Array<string> | null> {
  if (!(await isTestContainerReachable())) {
    return null;
  }

  const pg = postgres(`${config.baseURI}/postgres`, { max: 1 });

  try {
    const rows = await pg<Array<{ datname: string }>>`
      SELECT datname FROM pg_database WHERE datname LIKE ${String.raw`test\_template\_%`}
    `;

    const orphans = pickOrphanedTestTemplates({
      branches: config.branches,
      dbNames: rows.map((row) => row.datname),
    });

    for (const name of orphans) {
      await pg.unsafe(`DROP DATABASE ${name} WITH (FORCE)`);
    }

    return orphans;
  } finally {
    await pg.end();
  }
}
