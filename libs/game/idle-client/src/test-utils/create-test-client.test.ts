import { expect, test } from 'bun:test';
import { createTestClient } from './create-test-client';

test('it settles closed once the worker side closes its port', async () => {
  const testClient = createTestClient();

  testClient.port.close();

  await expect(testClient.closed).toResolve();
});
