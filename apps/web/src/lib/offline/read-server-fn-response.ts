import { NetworkFailureError } from './network-failure-error';

// fetch rejects with a TypeError only when the request never got a response, and each browser
// words that TypeError differently, so the class alone marks a network failure
export async function readServerFnResponse(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new NetworkFailureError({ cause: error });
    }

    throw error;
  }
}
