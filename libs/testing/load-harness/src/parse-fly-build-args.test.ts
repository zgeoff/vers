import { expect, test } from 'bun:test';
import { parseFlyBuildArgs } from './parse-fly-build-args';

test('it reads the build args of a fly config', () => {
  expect(
    parseFlyBuildArgs("app = 'vers-service-notes'\n\n[build]\n\n[build.args]\nSERVICE = 'notes'\n"),
  ).toStrictEqual({ SERVICE: 'notes' });
});

test('it reads a fly config with no build args as none', () => {
  expect(parseFlyBuildArgs("app = 'vers-app-notes'\n\n[build]\n")).toStrictEqual({});
});

test('it rejects a build arg that is not a string', () => {
  expect(() => parseFlyBuildArgs('[build.args]\nRETRIES = 3\n')).toThrow();
});
