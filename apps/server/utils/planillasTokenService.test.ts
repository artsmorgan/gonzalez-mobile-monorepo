import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    computePlanillasTokenTimestamps,
    isPlanillasTokenRecordValid,
    PlanillasTokenExpiredError,
} from "./planillasTokenService";

describe("planillasTokenService", () => {
    it("computePlanillasTokenTimestamps respeta expires_in en segundos", () => {
        const { created_at, expires_at } = computePlanillasTokenTimestamps(3600);
        const diffSeconds = Math.round((expires_at.getTime() - created_at.getTime()) / 1000);
        assert.equal(diffSeconds, 3600);
    });

    it("isPlanillasTokenRecordValid aplica buffer antes de expiración", () => {
        const future = new Date(Date.now() + 5 * 60 * 1000);
        assert.equal(isPlanillasTokenRecordValid({ expires_at: future }, 60), true);

        const soon = new Date(Date.now() + 30 * 1000);
        assert.equal(isPlanillasTokenRecordValid({ expires_at: soon }, 60), false);
    });

    it("PlanillasTokenExpiredError indica que el usuario debe iniciar sesión", () => {
        const err = new PlanillasTokenExpiredError();
        assert.match(err.message, /iniciar sesión/i);
        assert.equal(err.name, "PlanillasTokenExpiredError");
    });
});
