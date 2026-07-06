/** Payload shape for a data-less contract error (CONFLICT/NOT_FOUND/CODE_ALREADY_USED/...). */
export interface EmptyErrorPayload {
  readonly data: Record<never, never>;
}
