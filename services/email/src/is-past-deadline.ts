export function isPastDeadline(usefulUntil: Date): boolean {
  return Date.now() >= usefulUntil.getTime();
}
