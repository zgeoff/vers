import { expect, test } from 'bun:test';
import { buildLoadImageRefs } from './build-load-image-refs';

test('it tags one image per stack app with the commit', () => {
  expect(buildLoadImageRefs('a31aa1de')).toStrictEqual({
    LOAD_IMAGE_VERS_APP_WEB: 'vers-load/vers-app-web:a31aa1de',
    LOAD_IMAGE_VERS_SERVICE_ACTIVITY: 'vers-load/vers-service-activity:a31aa1de',
    LOAD_IMAGE_VERS_SERVICE_KEYS: 'vers-load/vers-service-keys:a31aa1de',
    LOAD_IMAGE_VERS_SERVICE_REPLAY: 'vers-load/vers-service-replay:a31aa1de',
    LOAD_IMAGE_VERS_SERVICE_REPLAY_RETAINED: 'vers-load/vers-service-replay-retained:a31aa1de',
    LOAD_IMAGE_VERS_SERVICE_SESSION: 'vers-load/vers-service-session:a31aa1de',
  });
});
