/**
 * How many avatars an account may hold per economy mode; `createAvatar` rejects past it with
 * LIMIT_REACHED, and clients may hide the create affordance once every mode is full.
 */
export const AVATAR_MODE_CAP = 5;
