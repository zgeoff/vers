export function createSeed() {
  return Date.now() ^ (Math.random() * 0x10000000);
}
