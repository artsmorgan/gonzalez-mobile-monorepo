import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require("jsonwebtoken");
import {
    decodeJwtPayloadUnsafe,
    getPlanillasSessionLifetimeSeconds,
    isPlanillasJwt,
    normalizePlanillasPayload,
    verifyPlanillasToken,
} from "./verifyPlanillasToken";
import { verifyMobileTokenString } from "./verifyMobileAccessToken";

const EXAMPLE_PLANILLAS_TOKEN =
    "eyJhbGciOiJSUzI1NiJ9.eyJyb2xlcyI6WyJST0xFX0NPTlNVTFRPUiJdLCJ1c2VybmFtZSI6IjEwNTU0MDIzMSIsImlhdCI6MTc4MjMxMzY1NiwiZXhwIjoxNzgyMzE3MjU2fQ.iNQW-aRIqcYAoV-w953gmdTWPa-IdHQY6EMVqnnJJWouXUKSNylXXgtrABIxeKEJNwIivHNcEakjlKV8Ro4rw_rMpRFJzVqg1JCwBDyZVtePLuT7D0sAuFqEnp4c-U5PKQGpBdEzLNVZihsGaHL0_xpA_oVLXJUmEJ3WroJzy_RqnSIiBhxX3_lIfPeQCmqO3DmNM5h1gcQslMzQt8xEEZhsegR_KNIILe0nZe_b6BeH1EdBFg4vP1RwN4W5RTpYQsvC2q6pJ5qXukRPZxW3507lPBcrZ3gR1mklXsVSQ8SycFFv7-NKA1bbiaOn1qX4sFb6cynhoTO5kx1giEj0PfhxFBAq6UsB17qyd36EZDdZ9T1KLqVoSOq6n9QemyguU-lna1vOvQYt1_9HUMQwtGPKs1nzCmcsVa25sDu-pjsNx5VeIlR448QEC8noK9VsEW1hoPxXqR1Fa0C0pFSfZUdgaGEHZ1tDcv8dUUwrlSN3y_y1U5g5llnWlt4m4Ryw49oSmtb34C_vmTNQNO4XXpl_lfp_8PqcmwxZi6cc2NG5A8ec1cXoGW_sP_X0DKuHNzpVuFEHEA28ahTBhYZ3Hc4cZa33wk49E9jA_YMjIHvQ-F2qVDfergQf4JJHBRGjWO3YP--_CjwCb0sRjbyXvTdb-CDlatqM9Hl-SrU0e9Q";

function createTestKeyPair() {
    return crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
}

function signPlanillasToken(
    privateKey: string,
    payload: Record<string, unknown>,
    options?: { expiresIn?: string | number }
) {
    return jwt.sign(payload, privateKey, {
        algorithm: "RS256",
        ...(options?.expiresIn != null ? { expiresIn: options.expiresIn } : {}),
    });
}

describe("verifyPlanillasToken", () => {
    it("detecta JWT Planillas del ejemplo compartido (RS256)", () => {
        assert.equal(isPlanillasJwt(EXAMPLE_PLANILLAS_TOKEN), true);
    });

    it("decodifica payload del JWT de ejemplo con sesión de 1 hora", () => {
        const payload = decodeJwtPayloadUnsafe(EXAMPLE_PLANILLAS_TOKEN);
        assert.ok(payload);
        assert.deepEqual(payload?.roles, ["ROLE_CONSULTOR"]);
        assert.equal(payload?.username, "105540231");
        assert.equal(payload?.iat, 1782313656);
        assert.equal(payload?.exp, 1782317256);
        assert.equal((payload?.exp ?? 0) - (payload?.iat ?? 0), getPlanillasSessionLifetimeSeconds());
    });

    it("normaliza username a empleado.id", async () => {
        const result = await normalizePlanillasPayload(
            {
                username: "105540231",
                roles: ["ROLE_CONSULTOR"],
                iat: 1782313656,
                exp: 1782317256,
            },
            async (cedula) => {
                assert.equal(cedula, "105540231");
                return { id: 42, cedula: "105540231" };
            }
        );

        assert.equal(result.valid, true);
        assert.equal(result.payload?.id, 42);
        assert.equal(result.payload?.sessionId, "105540231");
        assert.equal(result.payload?.username, "105540231");
        assert.equal(result.payload?.cedula, "105540231");
        assert.equal(result.payload?.username, "105540231");
        assert.equal(result.payload?.tokenType, "planillas");
        assert.deepEqual(result.payload?.roles, ["ROLE_CONSULTOR"]);
    });

    it("verifica firma RS256 y rechaza token expirado (1h)", async () => {
        const { publicKey, privateKey } = createTestKeyPair();
        const validToken = signPlanillasToken(privateKey, {
            roles: ["ROLE_CONSULTOR"],
            username: "999",
            iat: Math.floor(Date.now() / 1000),
        }, { expiresIn: "1h" });

        const valid = await verifyPlanillasToken(validToken, {
            publicKey,
            lookupEmpleado: async () => ({ id: 7, cedula: "999" }),
        });
        assert.equal(valid.valid, true);
        assert.equal(valid.payload?.id, 7);

        const expiredToken = signPlanillasToken(privateKey, {
            roles: ["ROLE_CONSULTOR"],
            username: "999",
        }, { expiresIn: -1 });

        const expired = await verifyPlanillasToken(expiredToken, {
            publicKey,
            lookupEmpleado: async () => ({ id: 7, cedula: "999" }),
        });
        assert.equal(expired.valid, false);
        assert.equal(expired.expired, true);
        assert.match(expired.message, /expirado/i);
    });

    it("verifyMobileTokenString enruta tokens Planillas y legacy", async () => {
        const { publicKey, privateKey } = createTestKeyPair();
        const planillasToken = signPlanillasToken(privateKey, {
            roles: ["ROLE_CONSULTOR"],
            username: "123",
        }, { expiresIn: "1h" });

        const planillasResult = await verifyMobileTokenString(planillasToken);
        assert.equal(planillasResult.valid, false);
        assert.match(planillasResult.message, /PLANILLAS_JWT_PUBLIC_KEY|inválido|no coincide|login/i);

        const withKey = await verifyPlanillasToken(planillasToken, {
            publicKey,
            lookupEmpleado: async () => ({ id: 3, cedula: "123" }),
        });
        assert.equal(withKey.valid, true);
    });

    it("verifica JWT de ejemplo cuando PLANILLAS_JWT_PUBLIC_KEY está configurado", async (t) => {
        const publicKey = process.env.PLANILLAS_JWT_PUBLIC_KEY?.trim();
        if (!publicKey || publicKey.includes("...")) {
            t.skip("PLANILLAS_JWT_PUBLIC_KEY no configurado");
            return;
        }

        const result = await verifyPlanillasToken(EXAMPLE_PLANILLAS_TOKEN, {
            publicKey: publicKey.includes("\\n") ? publicKey.replace(/\\n/g, "\n") : publicKey,
            lookupEmpleado: async (cedula) => ({ id: 1, cedula }),
        });

        assert.equal(result.valid, true);
        assert.equal(result.payload?.username, "105540231");
        assert.equal(result.payload?.id, 1);
    });
});
