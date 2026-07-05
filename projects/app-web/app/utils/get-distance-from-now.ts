import { formatDistance } from 'date-fns';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function getDistanceFromNow(date: Date): string {
  const formatOpts = { addSuffix: true, includeSeconds: true };

  return formatDistance(new Date(date), new Date(), formatOpts);
}
