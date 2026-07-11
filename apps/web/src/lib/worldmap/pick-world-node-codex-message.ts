export function pickWorldNodeCodexMessage(difficulty: number): string {
  if (difficulty >= 3) {
    return 'The world here churns with old violence — tread carefully.';
  }

  if (difficulty >= 2) {
    return 'A faint hum lingers in this node, a remnant of some struggle long past.';
  }

  return 'The world is calm here, for now.';
}
