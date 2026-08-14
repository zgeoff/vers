import { GlobalRegistrator } from '@happy-dom/global-registrator';

/**
 * Registers happy-dom's globals for a bun-test preload, then restores bun's native fetch stack
 * over happy-dom's replacements, since the two implementations aren't interoperable.
 */
export function registerHappyDOM(): void {
  const nativeFetchStack = {
    AbortController: globalThis.AbortController,
    AbortSignal: globalThis.AbortSignal,
    Blob: globalThis.Blob,
    fetch: globalThis.fetch,
    Headers: globalThis.Headers,
    ReadableStream: globalThis.ReadableStream,
    Request: globalThis.Request,
    Response: globalThis.Response,
    TransformStream: globalThis.TransformStream,
    WritableStream: globalThis.WritableStream,
  };

  GlobalRegistrator.register();

  // bun's ReadableStream.pipeTo rejects happy-dom's WritableStream, MSW's node interception reads
  // a Request's signal and a Response's body stream, and a happy-dom AbortSignal fails Bun's
  // Request constructor's own instance check — the whole fetch stack must come from one
  // implementation.
  Object.assign(globalThis, nativeFetchStack);
}
