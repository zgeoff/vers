/**
 * posts a message via our worker and waits for the first event that comes back.
 *
 * the names a little disingenuous because there's no such thing as a reply,
 * it's just the first event that comes back.
 */

interface Message {
  type: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM handle; readonly is semantically meaningless on a live SharedWorker
export function postMessageAndWaitForReply(worker: SharedWorker, message: Message) {
  return new Promise<MessageEvent<Message>>((resolve) => {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types, unicorn/prefer-add-event-listener -- assigning onmessage starts MessagePort delivery; addEventListener also needs an explicit port.start(); MessagePort is a live DOM handle with no readonly form
    worker.port.onmessage = (event: MessageEvent<Message>) => {
      resolve(event);
    };

    worker.port.postMessage(message);
  });
}
