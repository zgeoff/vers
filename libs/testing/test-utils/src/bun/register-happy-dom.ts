import { GlobalRegistrator } from '@happy-dom/global-registrator';

/**
 * Registers happy-dom's globals for a bun-test preload, then restores bun's native fetch stack
 * (fetch, Request, Response, Headers, Blob, AbortController, and the web-stream classes) over
 * happy-dom's replacements. The two implementations fail when mixed: bun's ReadableStream.pipeTo
 * rejects happy-dom's WritableStream, and MSW's node interception reads a Request's signal and a
 * Response's body stream, so the whole set must come from one implementation.
 */
export function registerHappyDOM(): void {
  const nativeFetchStack = {
    AbortController: globalThis.AbortController,
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
  Object.assign(globalThis, nativeFetchStack);
}
