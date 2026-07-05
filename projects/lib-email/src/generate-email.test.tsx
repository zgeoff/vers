import { expect, test } from 'vitest';
import { generateEmail } from './generate-email';

function TestEmail() {
  return (
    <div>
      <h1>Test Email</h1>
    </div>
  );
}

test('it generates both HTML and plain text versions of the email', async () => {
  const { html, plainText } = await generateEmail({
    component: <TestEmail />,
  });

  expect(html).toStartWith('<!DOCTYPE html');
  expect(html).toContain('Test Email');
  expect(html).not.toBe(plainText);

  expect(plainText).toContain('TEST EMAIL');
  expect(plainText).not.toStartWith('<!DOCTYPE html');
});
