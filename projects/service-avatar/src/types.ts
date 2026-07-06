/** Payload shape for an authed procedure's UNAUTHORIZED error when no acting user is present. */
export interface MissingSessionPayload {
  readonly data: { readonly reason: 'missing-session' };
}

/** Payload shape for a data-less contract error (CONFLICT/NOT_FOUND). */
export interface EmptyErrorPayload {
  readonly data: Record<never, never>;
}
