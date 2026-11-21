import { expect, test } from 'bun:test';
import { updateEnv } from '@zgeoff/testing';
import { createVerifyRegistry } from './create-verify-registry';

function setupTest() {
  return {
    registry: createVerifyRegistry({ chromiumLauncher: 'chromium-launcher', devtoolsPort: 9222 }),
  };
}

test('it uploads the evidence of every target to the file host', () => {
  const registry = setupTest().registry;

  expect(registry.targets.get('local')?.evidence).toBe('upload');
  expect(registry.targets.get('prod')?.evidence).toBe('upload');
});

test('it reads the file host and its token from the variables the verify skill tells agents to set', () => {
  updateEnv('CLOUD_FILES_URL', 'https://files.example.test/api/files');
  updateEnv('CLOUD_FILES_TOKEN', 'test-upload-token');

  const uploader = setupTest().registry.hooks.upload;

  expect(uploader?.linkHosts).toStrictEqual(['files.example.test']);

  expect(uploader?.readSecrets?.()).toStrictEqual([
    { name: 'CLOUD_FILES_TOKEN', value: 'test-upload-token', origin: 'collected' },
  ]);
});
