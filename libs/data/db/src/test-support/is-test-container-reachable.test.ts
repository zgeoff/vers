import { expect, test } from 'bun:test';
import { isTestContainerReachable } from './is-test-container-reachable';

test('it resolves true once the suite preload has confirmed the shared test container', async () => {
  const reachable = await isTestContainerReachable();

  expect(reachable).toBeTrue();
});
