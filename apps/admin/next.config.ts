import type { NextConfig } from "next";

// Painel autenticado e renderizado no cliente (dados vêm da API com token em memória):
// sem cacheComponents/partialPrefetching, pensados para páginas renderizadas no servidor.
const nextConfig: NextConfig = {
  // Os testes E2E (Playwright) compilam em outra pasta para não disputar a .next com o `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
