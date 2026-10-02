import type { NextConfig } from "next";

/**
 * Adjuntos en complaints-master van como JSON con file_base64; varios archivos
 * superan el default de 10MB del proxy de Next y el body se trunca → JSON inválido
 * ("Unterminated string..."). Subir ambos límites alineados.
 */
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "128mb",
    },
    /** Límite real del body bufferizado (el warning cita middlewareClientMaxBodySize; proxyClientMaxBodySize no aplica en esta versión). */
    middlewareClientMaxBodySize: "128mb",
  },
};

export default nextConfig;
