import { expect, test } from 'bun:test';
import bcrypt from 'bcryptjs';
import { hashPassword } from './hash-password';

test('it hashes a password using bcrypt', async () => {
  const password = 'test_password123';

  const hashedPassword = await hashPassword(password);

  expect(hashedPassword).not.toBe(password);

  // verify it's a valid bcrypt hash
  expect(hashedPassword).toMatch(/^\$2[ayb]\$.{56}$/);

  // verify we can compare the hash with the original password
  const isMatch = await bcrypt.compare(password, hashedPassword);

  expect(isMatch).toBeTrue();
});

test('it generates different hashes for the same password', async () => {
  const password = 'test_password123';

  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);

  // verify the hashes are different due to salt
  expect(firstHash).not.toBe(secondHash);

  // verify both hashes work with the original password
  const firstMatch = await bcrypt.compare(password, firstHash);
  const secondMatch = await bcrypt.compare(password, secondHash);

  expect(firstMatch).toBeTrue();
  expect(secondMatch).toBeTrue();
});

test('it generates hashes of consistent length', async () => {
  const shortPassword = 'abc';
  const longPassword = 'a'.repeat(100);

  const shortHash = await hashPassword(shortPassword);
  const longHash = await hashPassword(longPassword);

  // verify both hashes are the same length (60 avatars for bcrypt)
  expect(shortHash).toHaveLength(60);
  expect(longHash).toHaveLength(60);
});
