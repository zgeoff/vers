/**
 * The roster selection's non-redirect outcome. A successful pick ends in a thrown redirect to
 * `/explore` instead of a value here.
 */
export type AvatarSelectResult =
  | { readonly owningAvatarName: string; readonly status: 'activity-locked' }
  | { readonly status: 'failed' };
