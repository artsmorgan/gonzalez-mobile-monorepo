import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

const mobile = path.resolve(__dirname, "..", "..", "mobile");

/** Cabeceras propias que el cliente móvil agrega a sus peticiones (la versión web las manda y el navegador pide permiso con una consulta previa CORS). */
const CABECERAS_DE_LA_APP = ["Content-Type", "Authorization", "X-App-Version", "X-Device-Uid", "X-Guardify-Device", "Idempotency-Key", "Planillas-Token", "ngrok-skip-browser-warning", "X-Evidence-Lat", "X-Evidence-Lng", "X-Evidence-At", "X-Evidence-Perm"];

const permitidas = (): string[] => {
    const res = middleware(new NextRequest("http://localhost:3000/api/server-time", { method: "OPTIONS" }));
    return String(res.headers.get("access-control-allow-headers")).split(",").map((h) => h.trim().toLowerCase());
};

describe("CORS de /api (la app web manda cabeceras propias)", () => {
    it("permite todas las cabeceras propias que envía el cliente", () => {
        const lista = permitidas();
        for (const h of CABECERAS_DE_LA_APP) assert.ok(lista.includes(h.toLowerCase()), `falta ${h} en Access-Control-Allow-Headers`);
    });

    it("el navegador puede leer Idempotent-Replay", () => {
        const res = middleware(new NextRequest("http://localhost:3000/api/x", { method: "GET" }));
        assert.match(String(res.headers.get("access-control-expose-headers")).toLowerCase(), /idempotent-replay/);
    });

    it("la lista cubre toda cabecera propia que aparece como clave literal en el código móvil (x-…, planillas-token, idempotency-key, ngrok-…)", () => {
        const lista = permitidas();
        const archivos: string[] = [];
        const recorre = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                if (e.name === "node_modules" || e.name === "android" || e.name === ".expo") continue;
                const p = path.join(dir, e.name);
                if (e.isDirectory()) recorre(p);
                else if (/\.(ts|tsx)$/.test(e.name)) archivos.push(p);
            }
        };
        for (const d of ["hooks", "utils", "components", "screens", "contexts", "app"]) if (fs.existsSync(path.join(mobile, d))) recorre(path.join(mobile, d));
        const usadas = new Set<string>();
        const clave = /['"]((?:x-[a-z0-9-]+)|planillas-token|idempotency-key|ngrok-[a-z-]+)['"]\s*:/gi;
        for (const f of archivos) for (const m of fs.readFileSync(f, "utf8").matchAll(clave)) usadas.add(m[1].toLowerCase());
        assert.ok(usadas.size >= 5, "el escaneo debería encontrar las cabeceras conocidas");
        for (const h of usadas) assert.ok(lista.includes(h), `el cliente manda ${h} y el servidor no lo permite`);
    });

    it("la lista cubre cada cabecera fija que el cliente declara con headers.set", () => {
        const lista = permitidas();
        const fuentes = ["hooks/installEvidenceFetch.ts", "hooks/authedFetch.ts", "hooks/idempotencyKey.ts"].map((f) => fs.readFileSync(path.join(mobile, f), "utf8")).join("\n");
        const usadas = new Set([...fuentes.matchAll(/headers\.set\(\s*['"]([A-Za-z0-9-]+)['"]/g)].map((m) => m[1].toLowerCase()));
        for (const h of usadas) assert.ok(lista.includes(h), `el cliente manda ${h} y el servidor no lo permite`);
    });
});
