export async function recoverFailedRequest(
  _request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  // srvx chains the fetch handler's promise with no rejection handler, so a rejection that escapes
  // here ends the Node process; Start rejects with the abort reason when a client drops a request
  try {
    return await next();
  } catch {
    return new Response(null, { status: 500 });
  }
}
