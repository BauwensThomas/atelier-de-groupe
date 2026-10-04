// Suivi des erreurs côté serveur (routes, pages, proxy) avec Sentry. Réglages : lib/sentry-scrub.ts.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  const { sentryOptions } = await import("@/lib/sentry-scrub");
  Sentry.init(sentryOptions);
}

export const onRequestError = Sentry.captureRequestError;
