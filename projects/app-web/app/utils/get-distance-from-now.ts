import { formatDistance } from 'date-fns';

export function getDistanceFromNow(date: Date): string {
  const formatOpts = { addSuffix: true, includeSeconds: true };

  return formatDistance(new Date(date), new Date(), formatOpts);
}
