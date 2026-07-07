/** What a verification type's post-verify continuation needs: who/what it verified for. */
export interface HandleVerificationContext {
  readonly redirectTo?: string | undefined;
  readonly target: string;
}
