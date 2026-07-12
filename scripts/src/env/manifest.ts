import type { EnvFileManifestEntry } from './types';

/**
 * The gitignored local env files `env:pull` materializes from the `vers`
 * 1Password vault. Each entry's `itemTitle` item carries the file's full
 * contents in its `notesPlain` field; `targetPath` is repo-root relative.
 */
export const ENV_FILE_MANIFEST: ReadonlyArray<EnvFileManifestEntry> = [
  {
    itemTitle: 'DOTENV_APP_WEB_E2E (app-web-e2e CI .env)',
    targetPath: 'apps/web-e2e/.env',
    vault: 'vers',
  },
  {
    itemTitle: 'DOTENV_APP_WEB_DEV (app-web CI .env.development.local)',
    targetPath: 'apps/web/.env.development.local',
    vault: 'vers',
  },
  {
    itemTitle: 'DOTENV_LIBS_DATA_DB (libs/data/db .env.local)',
    targetPath: 'libs/data/db/.env.local',
    vault: 'vers',
  },
];
