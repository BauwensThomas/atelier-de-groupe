import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  // En-têtes de sécurité sur toutes les pages :
  // - le site ne peut pas être affiché dans la page d'un autre site (seulement par lui-même, pour les PDF) ;
  // - le navigateur ne devine pas le type d'un fichier ;
  // - les autres sites (visionneuse Microsoft…) ne reçoivent que l'adresse du site, pas celle de la page ;
  // - pas d'accès à la caméra, au micro ni à la position.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

// Sentry (suivi des erreurs) : les rapports passent par notre site, sous un nom tiré au hasard à chaque déploiement
// (les bloqueurs de pub connaissent "/monitoring" et le bloquaient). proxy.ts ne surveille pas ce chemin. Au déploiement, les correspondances avec le code source sont envoyées à Sentry puis effacées
// (jamais publiées sur le site). Le jeton SENTRY_AUTH_TOKEN reste côté serveur (Vercel et .env.local).
export default withSentryConfig(nextConfig, {
  org: "atelier-de-groupe",
  project: "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  tunnelRoute: true,
  widenClientFileUpload: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true },
});
