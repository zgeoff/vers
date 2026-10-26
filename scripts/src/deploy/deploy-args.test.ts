import { expect, test } from 'bun:test';
import { parseArgs, resolveArgs } from 'gunshi';
import { DEPLOY_APP_ARGS } from './deploy-args';

test('it reads the app name', () => {
  const resolved = resolveArgs(DEPLOY_APP_ARGS, parseArgs(['--app', 'vers-web']));

  expect(resolved.error).toBeUndefined();
  expect({ ...resolved.values }).toStrictEqual({ app: 'vers-web' });
});

test('it requires the app name', () => {
  const resolved = resolveArgs(DEPLOY_APP_ARGS, parseArgs([]));

  expect(resolved.error?.errors).toPartiallyContain({ code: 'err:arg:required-option' });
});
