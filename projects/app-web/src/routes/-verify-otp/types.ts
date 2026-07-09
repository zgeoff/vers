/** What a verification type's post-verify continuation needs: who/what it verified for. */
export interface RunVerificationContext {
  readonly redirectTo?: string | undefined;
  readonly target: string;
}
