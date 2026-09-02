export interface MissingSessionPayload {
  readonly data: { readonly reason: 'missing-session' };
}

export interface EmptyErrorPayload {
  readonly data: Record<never, never>;
}
