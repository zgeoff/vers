/**
 * The hidden field a real caller never fills in; any value here marks the submission as spam.
 */
export const HONEYPOT_FIELD_NAME = 'name__confirm';

/**
 * Encodes the earliest timestamp (ms epoch) a submission of this render counts as human-paced.
 */
export const HONEYPOT_VALID_FROM_FIELD_NAME = 'from__confirm';
