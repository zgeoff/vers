import type { EnvFileManifestEntry } from './types';

export const ENV_FILE_MANIFEST: ReadonlyArray<EnvFileManifestEntry> = [
  {
    itemTitle: 'DOTENV_APP_WEB_E2E',
    targetPath: 'apps/web/.env.e2e',
    vault: 'vers-ci',
  },
  {
    itemTitle: 'DOTENV_APP_WEB_DEV',
    targetPath: 'apps/web/.env.development.local',
    vault: 'vers-ci',
  },
  {
    itemTitle: 'DOTENV_LIBS_DATA_DB (libs/data/db .env.local)',
    targetPath: 'libs/data/db/.env.local',
    vault: 'vers',
  },
];
