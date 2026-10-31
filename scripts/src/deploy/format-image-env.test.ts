import { expect, test } from 'bun:test';
import { formatImageEnv } from './format-image-env';

test('it writes one IMAGE_ line per app, with the app name upper-cased and dashes as underscores', () => {
  expect(
    formatImageEnv({
      'vers-app-web': 'registry.fly.io/vers-app-web:4f1c9a2',
      'vers-service-user': 'registry.fly.io/vers-service-user:0b7e3d1',
    }),
  ).toBe(
    'IMAGE_VERS_APP_WEB=registry.fly.io/vers-app-web:4f1c9a2\nIMAGE_VERS_SERVICE_USER=registry.fly.io/vers-service-user:0b7e3d1\n',
  );
});

test('it writes nothing when no app has an image', () => {
  expect(formatImageEnv({})).toBe('');
});
