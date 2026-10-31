import { expect, test } from 'bun:test';
import { buildPulumiBackendURL } from './build-pulumi-backend-url';

test("it points Pulumi at the bucket through the account's R2 endpoint", () => {
  expect(buildPulumiBackendURL({ bucket: 'kiln-state', cloudflareAccountID: '0a1b2c3d' })).toBe(
    's3://kiln-state?endpoint=0a1b2c3d.r2.cloudflarestorage.com&region=auto&s3ForcePathStyle=true',
  );
});
