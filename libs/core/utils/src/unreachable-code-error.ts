/**
 * An error thrown to mark a code path as unreachable.
 *
 * Use it after a statement that always diverts control flow (for example a
 * thrown redirect) so the type checker treats any following code as dead.
 */
export class UnreachableCodeError extends Error {
  constructor(message?: string) {
    super(message);

    this.name = 'UnreachableCodeError';
  }
}
