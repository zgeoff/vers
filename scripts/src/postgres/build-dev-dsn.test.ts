import { expect, test } from 'bun:test';
import { buildDevDSN } from './build-dev-dsn';

test('it swaps the database while preserving credentials, host, and query', () => {
  const dsn = buildDevDSN(
    'postgresql://mcp_dev:secret@ep-example.aws.neon.tech/vers?sslmode=verify-full',
    'dev_geoffbox_main',
  );

  expect(dsn).toBe(
    'postgresql://mcp_dev:secret@ep-example.aws.neon.tech/dev_geoffbox_main?sslmode=verify-full',
  );
});
