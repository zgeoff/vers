import * as z from 'zod';

const MockLiveRunSchema = z.object({ activityID: z.string() });

export async function createMockLiveRun(
  mockActivityURL: string | undefined,
  email: string,
): Promise<string> {
  if (mockActivityURL === undefined) {
    throw new Error('codeSource "mock" requires mockActivityURL');
  }

  const response = await fetch(
    `${mockActivityURL}/test/live-run?${new URLSearchParams({ email })}`,
    { method: 'POST' },
  );

  if (!response.ok) {
    throw new Error(`the mock activity service refused the live run with ${response.status}`);
  }

  const body: unknown = await response.json();

  return MockLiveRunSchema.parse(body).activityID;
}
