import { expect, test } from 'bun:test';
import { EmailJobOutputSchema } from './email-job-output-schema';

test('it accepts a well-formed job output', () => {
  expect(EmailJobOutputSchema.safeParse({ jobID: 'job_1' }).success).toBeTrue();
});

test('it rejects an output missing the jobID', () => {
  expect(EmailJobOutputSchema.safeParse({}).success).toBeFalse();
});
