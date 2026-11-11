import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { evaluateAppVersion } from "./utils/appVersionGate";

function withCorsHeaders(response: NextResponse): NextResponse {
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

export function middleware(request: NextRequest) {
  // Control de versión (APP_LAST_VERSION + FORCE_APP_LAST_VERSION): la app declara su versión en `X-App-Version` (o `app_version` en la URL de los
  // archivos que no pueden mandar cabeceras). Si no es la exigida, se responde 426 con el mensaje; la consulta y la descarga de la última versión
  // quedan exentas (ver utils/appVersionGate.ts).
  const gate = evaluateAppVersion({
    pathname: request.nextUrl.pathname,
    method: request.method,
    headerVersion: request.headers.get("x-app-version"),
    queryVersion: request.nextUrl.searchParams.get("app_version"),
  });
  if (gate.blocked) return withCorsHeaders(NextResponse.json(gate.body, { status: gate.status }));

  return withCorsHeaders(NextResponse.next());
}

export const config = {
  matcher: "/api/:path*",
};
