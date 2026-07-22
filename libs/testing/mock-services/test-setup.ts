import { faker } from '@faker-js/faker';
import { registerBunTestCleanup } from '@vers/test-utils/bun';
import { registerMockDBReset } from './src/bun';

// a throwaway dev-only Ed25519 PKCS8 key, so mock access tokens can be signed under `bun test`
process.env['SERVICE_AUTH_PRIVATE_KEY'] = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIBMom57erggdVdDCIdRWS+NKMykK+I5BUKpuHziAq+0W
-----END PRIVATE KEY-----`;

// a fixed seed keeps faker-defaulted mock rows reproducible run-to-run
faker.seed(1);

registerBunTestCleanup();
registerMockDBReset();
