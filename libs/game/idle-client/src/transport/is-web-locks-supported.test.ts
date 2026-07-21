import { expect, onTestFinished, test } from 'bun:test';
import { isWebLocksSupported } from './is-web-locks-supported';

test('it reports unsupported when the property is a bare null placeholder', () => {
  expect(isWebLocksSupported()).toBeFalse();
});

test('it reports supported when a locks manager is present', () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');

  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: () => Promise.resolve() },
  });

  onTestFinished(() => {
    if (descriptor === undefined) {
      Reflect.deleteProperty(navigator, 'locks');

      return;
    }

    Object.defineProperty(navigator, 'locks', descriptor);
  });

  expect(isWebLocksSupported()).toBeTrue();
});
