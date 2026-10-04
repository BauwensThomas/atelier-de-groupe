import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

// Nettoyage des rapports d'erreur avant l'envoi à Sentry (navigateur et serveur).
// Rien de personnel ni de secret ne part : pas d'adresse IP, de cookies ni d'en-têtes, et les adresses sont
// coupées de leur partie après "?" (jeton de décision) et après "#" (clé du lien professeur). Les liens
// temporaires de la visionneuse perdent leur jeton.

export function scrubUrl(url: string): string {
  return url
    .replace(/[?#].*$/, "")
    .replace(/\/api\/files\/link\/[^/]+\//, "/api/files/link/[lien]/");
}

function scrubAny(value: unknown): unknown {
  return typeof value === "string" ? scrubUrl(value) : value;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
    delete event.request.data;
  }
  delete event.user;
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null);
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.data) {
    for (const key of ["url", "from", "to"]) {
      if (key in breadcrumb.data) breadcrumb.data[key] = scrubAny(breadcrumb.data[key]);
    }
  }
  return breadcrumb;
}

/** Réglages communs : seulement les erreurs, aucune donnée personnelle, pas de suivi des performances. */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};
