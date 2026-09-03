import path from 'node:path';
import { pathToFileURL } from 'node:url';
import invariant from 'tiny-invariant';
import type { DeployManifest } from './types';

export async function loadDeployManifest(): Promise<DeployManifest> {
  const configPath = path.resolve(import.meta.dirname, '../../../deploy.config.ts');

  const configModule: unknown = await import(pathToFileURL(configPath).href);

  invariant(
    isManifestModule(configModule),
    `deploy.config.ts must default-export a manifest with an apps array (${configPath})`,
  );

  return configModule.default;
}

function isManifestModule(value: unknown): value is { default: DeployManifest } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'default' in value &&
    typeof value.default === 'object' &&
    value.default !== null &&
    'apps' in value.default &&
    Array.isArray(value.default.apps)
  );
}
