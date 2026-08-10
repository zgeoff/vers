import { expect, test } from 'bun:test';
import { loadBundledContentVersion } from './load-bundled-content-version';

test('it reads the bundled content version from its source module', async () => {
  const version = await loadBundledContentVersion();

  expect(version).toBe('2');
});
