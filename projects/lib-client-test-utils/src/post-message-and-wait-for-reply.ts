/**
 * posts a message via our worker and waits for the first event that comes back.
 *
 * the names a little disingenuous because there's no such thing as a reply,
 * it's just the first event that comes back.
 */

interface Message {
  type: string;
}
export function postMessageAndWaitForReply(worker: SharedWorker, message: Message) {
  return new Promise<MessageEvent<Message>>((resolve) => {
    // eslint-disable-next-line unicorn/prefer-add-event-listener
    worker.port.onmessage = (event: MessageEvent<Message>) => {
      resolve(event);
    };

    worker.port.postMessage(message);
  });
}
