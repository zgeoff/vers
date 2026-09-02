export interface AvatarCreateResult {
  readonly fieldErrors: Readonly<Partial<Record<'mode' | 'name', string>>>;
  readonly status: 'invalid-fields';
}
