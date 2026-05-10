/**
 * Lightweight error tracking shim. Replace with Sentry or similar in production
 * by wiring the init/capture functions here.
 */

type Context = Record<string, unknown>;

let initialized = false;

export function initErrorTracking() {
  if (initialized) return;
  initialized = true;

  if (typeof window !== "undefined") {
    window.addEventListener("error", (e) => trackError(e.error ?? new Error(e.message)));
    window.addEventListener("unhandledrejection", (e) =>
      trackError(e.reason instanceof Error ? e.reason : new Error(String(e.reason))),
    );
  }
}

export function trackError(error: Error, context?: Context) {
  // eslint-disable-next-line no-console
  console.error("[error]", error, context);
  // Hook: send to Sentry, Datadog, etc.
}

export function trackEvent(name: string, props?: Context) {
  // eslint-disable-next-line no-console
  console.debug("[event]", name, props ?? {});
}
