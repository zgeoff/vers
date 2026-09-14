import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { Element, Node } from 'happy-dom';

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

  registerCompactNodeInspection();

  // the whole fetch stack must come from one implementation: bun's ReadableStream.pipeTo rejects
  // happy-dom's WritableStream, and a happy-dom AbortSignal fails bun's Request constructor's
  // instance check, which MSW's node interception hits when it reads a Request's signal.
  Object.assign(globalThis, nativeFetchStack);
}

interface InspectableNode {
  readonly nodeName: string;
  readonly nodeValue: null | string;
}

const INSPECT_SYMBOL = Symbol.for('nodejs.util.inspect.custom');

// a failed matcher prints the received node through Bun.inspect, whose default walk of a happy-dom
// node's internal graph costs hundreds of milliseconds and starves the event loop under a polling
// waitFor; the node prints as its opening tag instead
function registerCompactNodeInspection(): void {
  Object.defineProperty(Node.prototype, INSPECT_SYMBOL, {
    configurable: true,
    value(this: InspectableNode): string {
      return formatNode(this);
    },
  });
}

function formatNode(node: InspectableNode): string {
  if (node instanceof Element) {
    const attributes = Array.from(
      node.attributes,
      (attribute) => ` ${attribute.name}="${attribute.value}"`,
    ).join('');

    return `<${node.tagName.toLowerCase()}${attributes}>`;
  }

  return node.nodeValue === null
    ? node.nodeName
    : `${node.nodeName} ${JSON.stringify(node.nodeValue)}`;
}
