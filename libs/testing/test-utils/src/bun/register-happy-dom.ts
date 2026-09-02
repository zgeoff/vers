import { GlobalRegistrator } from '@happy-dom/global-registrator';

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

  // the whole fetch stack must come from one implementation: bun's ReadableStream.pipeTo rejects
  // happy-dom's WritableStream, and a happy-dom AbortSignal fails bun's Request constructor's
  // instance check, which MSW's node interception hits when it reads a Request's signal.
  Object.assign(globalThis, nativeFetchStack);
}
