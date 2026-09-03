type AnalyticsEventName = 'avatar-created' | 'onboarding-complete' | 'signup-complete';

interface UmamiTracker {
  readonly track: (eventName: string) => void;
}

declare global {
  var umami: UmamiTracker | undefined;
}

export function sendAnalyticsEvent(eventName: AnalyticsEventName): void {
  globalThis.umami?.track(eventName);
}
