import { expect, test } from 'bun:test';
import { FlyctlError } from './flyctl-error';

test('it keeps a build secret value out of its message', () => {
  const error = new FlyctlError({
    args: ['deploy', '--build-secret', 'UPLOAD_TOKEN=s3cr3t-value', '--build-arg', 'REGION=syd'],
    exitCode: 1,
    signal: null,
    stalledAfterMs: null,
    stderr: '',
    stdout: '',
  });

  expect(error.message).toBe(
    'flyctl deploy --build-secret UPLOAD_TOKEN=[redacted] --build-arg REGION=syd failed with exit code 1',
  );
});
