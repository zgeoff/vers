// Fly machine names are unique per app, so a machine that replaces a scheduled machine before the
// old one is destroyed takes another name, and the declared name travels in this metadata key
export const SCHEDULED_MACHINE_METADATA_KEY = 'vers_scheduled_machine';
