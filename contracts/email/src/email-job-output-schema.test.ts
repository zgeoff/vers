import { expect, test } from 'bun:test';
import { EmailJobOutputSchema } from './email-job-output-schema';

test('it accepts a well-formed job output', () => {
  expect(EmailJobOutputSchema.safeParse({ jobID: 'job_1' }).success).toBeTrue();
});

test('it rejects an output missing the jobID', () => {
  const result = EmailJobOutputSchema.safeParse({});

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['jobID'] }));
});
