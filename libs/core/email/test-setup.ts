import { afterEach, expect } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { registerMSWLifecycle } from '@vers/test-utils/bun';
import { server } from './src/mocks/node';

// bun's native web-stream classes, captured before happy-dom overwrites them with its own
// incompatible implementations: @react-email/render pipes a real ReadableStream to a
// WritableStream, and bun's ReadableStream.pipeTo rejects happy-dom's WritableStream
const nativeReadableStream = globalThis.ReadableStream;
const nativeTransformStream = globalThis.TransformStream;
const nativeWritableStream = globalThis.WritableStream;

GlobalRegistrator.register();

Object.assign(globalThis, {
  ReadableStream: nativeReadableStream,
  TransformStream: nativeTransformStream,
  WritableStream: nativeWritableStream,
});

expect.extend(jestDOMMatchers);

registerMSWLifecycle(server);

// dynamic import: RTL reads `document` at import time, so it must load after registration
const reactTestingLibrary = await import('@testing-library/react');

afterEach(() => {
  reactTestingLibrary.cleanup();
});
