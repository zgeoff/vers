export type AvatarSelectResult =
  | { readonly owningAvatarName: string; readonly status: 'activity-locked' }
  | { readonly status: 'failed' };
