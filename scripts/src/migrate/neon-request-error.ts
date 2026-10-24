export class NeonRequestError extends Error {
  readonly status: number;

  constructor(method: string, path: string, status: number, detail: string) {
    super(`Neon ${method} ${path} failed with ${status}: ${detail}`);

    this.name = 'NeonRequestError';
    this.status = status;
  }
}
