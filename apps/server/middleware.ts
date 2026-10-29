import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  // La app web (Expo) manda estas cabeceras propias; sin ellas el navegador bloquea la consulta previa CORS.
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-App-Version, X-Device-Uid, X-Guardify-Device, Idempotency-Key, Planillas-Token, ngrok-skip-browser-warning, X-Evidence-Lat, X-Evidence-Lng, X-Evidence-At, X-Evidence-Perm",
  );
  // Para que el navegador pueda leer que una respuesta es la repetición de una petición idempotente.
  response.headers.set("Access-Control-Expose-Headers", "Idempotent-Replay");

  return response;
}

export const config = {
  matcher: "/api/:path*",
};