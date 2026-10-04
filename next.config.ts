import type { NextConfig } from "next";

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

export default nextConfig;
