/**
 * The avatar-create form's non-redirect outcome. A successful create ends in a thrown redirect to
 * `/avatar` instead of a value here.
 */
export interface AvatarCreateResult {
  readonly fieldErrors: Readonly<Partial<Record<'class' | 'name', string>>>;
  readonly status: 'invalid-fields';
}
