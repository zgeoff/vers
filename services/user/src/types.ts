export interface MissingSessionPayload {
  readonly data: { readonly reason: 'missing-session' };
}

export interface EmptyErrorPayload {
  readonly data: Record<string, never>;
}

export interface FieldConflictPayload<Field extends string> {
  readonly data: { readonly field: Field };
}
