import { expect, test } from 'bun:test';
import { parseDatabaseTarget } from './parse-database-target';

test('it marks the local compose database as a loopback target', () => {
  expect(parseDatabaseTarget('postgresql://admin:password@localhost:5433/vers')).toStrictEqual({
    host: 'localhost:5433',
    isLoopback: true,
  });
});

test('it marks a numeric loopback address as a loopback target', () => {
  expect(parseDatabaseTarget('postgresql://admin:password@127.0.0.1:32999/vers')).toStrictEqual({
    host: '127.0.0.1:32999',
    isLoopback: true,
  });
});

test('it marks a hosted database as a non-loopback target', () => {
  expect(
    parseDatabaseTarget(
      'postgresql://neondb_owner:secret@ep-example-123456.ap-southeast-2.aws.neon.tech/vers?sslmode=verify-full',
    ),
  ).toStrictEqual({
    host: 'ep-example-123456.ap-southeast-2.aws.neon.tech',
    isLoopback: false,
  });
});

test('it rejects a connection string that is not a URL', () => {
  expect(() => parseDatabaseTarget('not a url')).toThrowWithMessage(Error, /not a valid URL/);
});
