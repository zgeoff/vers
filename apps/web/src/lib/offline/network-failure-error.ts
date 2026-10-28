export class NetworkFailureError extends Error {
  constructor(options: Readonly<{ cause: unknown }>) {
    super('the network request never reached the server', options);

    this.name = 'NetworkFailureError';
  }
}
