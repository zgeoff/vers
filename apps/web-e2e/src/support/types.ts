type CodeSource = 'mock' | 'stack';

/**
 * The two backends the converged spec set can run against: which project option each config sets
 * in its `use` block, so `waitForVerificationCode` knows where to poll for the onboarding code.
 */
export interface JourneyOptions {
  readonly codeSource: CodeSource;
  readonly mockVerificationURL?: string;
  readonly resendStubURL?: string;
}

/**
 * The account a journey helper drives through signup, onboarding, and avatar creation.
 */
export interface JourneyAccount {
  readonly avatarName: string;
  readonly email: string;
  readonly password: string;
  readonly username: string;
}
