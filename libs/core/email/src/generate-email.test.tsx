import { expect, test } from 'bun:test';
import { generateEmail } from './generate-email';

function TestEmail() {
  return (
    <div>
      <h1>Test Email</h1>
    </div>
  );
}

test('it generates both HTML and plain text versions of the email', async () => {
  const email = await generateEmail({
    component: <TestEmail />,
  });

  expect(email.html).toStartWith('<!DOCTYPE html');
  expect(email.html).toContain('Test Email');
  expect(email.html).not.toBe(email.plainText);
  expect(email.plainText).toContain('TEST EMAIL');
  expect(email.plainText).not.toStartWith('<!DOCTYPE html');
});
