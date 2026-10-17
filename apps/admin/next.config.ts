import type { NextConfig } from "next";

// Painel autenticado e renderizado no cliente (dados vêm da API com token em memória):
// sem cacheComponents/partialPrefetching, pensados para páginas renderizadas no servidor.
const nextConfig: NextConfig = {
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
