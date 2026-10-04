// Suivi des erreurs dans le navigateur (Sentry). Réglages et nettoyage : lib/sentry-scrub.ts.
// Pas d'enregistrement d'écran (Session Replay) ni de suivi des performances.
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-scrub";

Sentry.init(sentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
