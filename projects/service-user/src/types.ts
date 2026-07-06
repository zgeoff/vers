/** Payload shape for an authed procedure's UNAUTHORIZED error when no acting user is present. */
export interface MissingSessionPayload {
  readonly data: { readonly reason: 'missing-session' };
}

/** Payload shape for a data-less contract error (CONFLICT/NOT_FOUND/...). */
export interface EmptyErrorPayload {
  readonly data: Record<never, never>;
}

/** Payload shape for a CONFLICT error naming which unique field collided. */
export interface FieldConflictPayload<Field extends string> {
  readonly data: { readonly field: Field };
}
