import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import invariant from 'tiny-invariant';
import { buildEnvRows } from './build-env-rows';
import { mergeEnvSection } from './merge-env-section';
import { parseEnvExample } from './parse-env-example';
import { renderEnvTable } from './render-env-table';
import type { EnvSchemaLike } from './types';

type EnvSource =
  | {
      readonly examplePath: string;
      readonly kind: 'env-example';
      readonly readmePath: string;
    }
  | {
      readonly includeBase: boolean;
      readonly kind: 'zod';
      readonly modulePath: string;
      readonly readmePath: string;
    };

/**
 * Modules the service glob can't discover: the web app's schema, and `.env.example`-documented
 * projects with no zod contract.
 */
const EXPLICIT_SOURCES: ReadonlyArray<EnvSource> = [
  {
    includeBase: false,
    kind: 'zod',
    modulePath: 'apps/web/src/server/web-env-schema.ts',
    readmePath: 'apps/web/README.md',
  },
  {
    examplePath: 'apps/web-e2e/.env.example',
    kind: 'env-example',
    readmePath: 'apps/web-e2e/README.md',
  },
  { examplePath: 'infra/.env.example', kind: 'env-example', readmePath: 'infra/README.md' },
];

const BASE_SHAPE_MODULE = 'libs/service/service-runtime/src/base-env-schema.ts';

interface RefreshReadmesConfig {
  /**
   * When set, stale READMEs are reported but never written.
   */
  readonly check: boolean;
  readonly rootDir: string;
}

/**
 * Regenerates every README env table from its live env contract, returning the paths whose
 * rendered table differs from what the README holds.
 */
export async function refreshReadmes(
  config: Readonly<RefreshReadmesConfig>,
): Promise<Array<string>> {
  const sources = [...collectServiceSources(config.rootDir), ...EXPLICIT_SOURCES];
  const stale: Array<string> = [];

  for (const source of sources) {
    const table = await buildTable(config.rootDir, source);

    const readmePath = join(config.rootDir, source.readmePath);
    const readme = readFileSync(readmePath, 'utf8');
    const next = mergeEnvSection(readme, table);

    if (next !== readme) {
      stale.push(source.readmePath);

      if (!config.check) {
        writeFileSync(readmePath, next);
      }
    }
  }

  return stale;
}

function collectServiceSources(rootDir: string): Array<EnvSource> {
  const glob = new Bun.Glob('services/*/src/*-env-shape.ts');

  return [...glob.scanSync({ cwd: rootDir })].toSorted().map((modulePath) => {
    const [, service] = modulePath.split('/');

    invariant(service !== undefined, `unexpected env-shape path ${modulePath}`);

    return {
      includeBase: true,
      kind: 'zod',
      modulePath,
      readmePath: `services/${service}/README.md`,
    };
  });
}

async function buildTable(rootDir: string, source: EnvSource): Promise<string> {
  if (source.kind === 'env-example') {
    const rows = parseEnvExample(readFileSync(join(rootDir, source.examplePath), 'utf8'));

    return renderEnvTable(rows, { includePresence: false });
  }

  const shape = {
    ...(source.includeBase ? await loadShape(rootDir, BASE_SHAPE_MODULE) : {}),
    ...(await loadShape(rootDir, source.modulePath)),
  };

  return renderEnvTable(buildEnvRows(shape), { includePresence: true });
}

/**
 * Imports an env module and returns its one schema export as a flat shape record — a zod object's
 * `.shape`, or a plain record of per-key schemas as-is.
 */
async function loadShape(
  rootDir: string,
  modulePath: string,
): Promise<Record<string, EnvSchemaLike>> {
  const mod: unknown = await import(join(rootDir, modulePath));

  invariant(typeof mod === 'object' && mod !== null, `env module ${modulePath} has no exports`);

  const shape = findShape(mod);

  invariant(shape, `no env schema export found in ${modulePath}`);

  return shape;
}

function findShape(mod: object): Record<string, EnvSchemaLike> | undefined {
  for (const value of Object.values(mod)) {
    if (isSchemaLike(value)) {
      return 'shape' in value && isShapeRecord(value.shape) ? value.shape : {};
    }

    if (isShapeRecord(value)) {
      return value;
    }
  }

  return undefined;
}

function isSchemaLike(value: unknown): value is EnvSchemaLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'safeParse' in value &&
    typeof value.safeParse === 'function'
  );
}

function isShapeRecord(value: unknown): value is Record<string, EnvSchemaLike> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const entries = Object.values(value);

  return entries.length > 0 && entries.every((entry) => isSchemaLike(entry));
}
