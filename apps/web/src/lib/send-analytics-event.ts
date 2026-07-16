/**
 * The analytics event names the app reports — the acquisition funnel's conversion steps. Analytics
 * events are a small curated set: they stay anonymous, carry no payload, and never duplicate the
 * behavioural game-event stream (`docs/architecture/analytics.md`).
 */
type AnalyticsEventName = 'avatar-created' | 'onboarding-complete' | 'signup-complete';

interface UmamiTracker {
  readonly track: (eventName: string) => void;
}

declare global {
  var umami: UmamiTracker | undefined;
}

/**
 * Sends one named event to analytics through the Umami tracker's global. Fire-and-forget: with no
 * tracker on the page — every non-production build, or a visitor blocking it — the call is a no-op,
 * so callers never gate on analytics.
 */
export function sendAnalyticsEvent(eventName: AnalyticsEventName): void {
  globalThis.umami?.track(eventName);
}
