/**
 * An error that should never be thrown.
 *
 * This error is used to indicate a piece of code should never be reached.
 * For example, there's an awkward pattern we use in our React Router code
 * where we throw a redirect inside our `logout` method as returning a redirect
 * is far more complicated and ugly, so we use this to make sure TypeScript knows
 * any following code should never be reached.
 */
export class UnreachableCodeError extends Error {
  constructor(message?: string) {
    super(message);

    this.name = 'UnreachableCodeError';
  }
}
