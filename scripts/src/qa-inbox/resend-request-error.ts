export class ResendRequestError extends Error {
  readonly status: number;

  constructor(path: string, status: number, detail: string) {
    super(`Resend GET ${path} failed with ${status}: ${detail}`);

    this.name = 'ResendRequestError';
    this.status = status;
  }
}
