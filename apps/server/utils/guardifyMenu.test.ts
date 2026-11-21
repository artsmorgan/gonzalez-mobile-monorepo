import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GUARDIFY_SCREENS, guardifyGoverns, menuContext, screenVisible, type GuardifyAccess } from "../../mobile/hooks/guardifyMenu";

const supervisor: GuardifyAccess = {
  externalUserId: "111",
  role: "Supervisor",
  grants: ["bitacora.registro-de-personas", "supervision.checklist-de-supervision", "asistencia.solicitud-de-permiso"],
  conditions: {
    "bitacora.registro-de-personas": { marca: ["vigente"], division: ["Administrativos", "Seguridad"] },
    "supervision.checklist-de-supervision": { marca: ["vigente"] },
  },
};
const conMarca = menuContext({ hasCurrentMarca: true, division: "Seguridad" });
const sinMarca = menuContext({ hasCurrentMarca: false, division: null });

describe("menú con Guardify (fase 2 de roles)", () => {
  it("sin sesión de Guardify, o con la de otra persona, rige la regla de siempre de la app", () => {
    for (const legacy of [true, false]) {
      assert.equal(screenVisible("visitors", { access: null, cedula: "111", legacy, context: conMarca }), legacy);
      assert.equal(screenVisible("visitors", { access: supervisor, cedula: "222", legacy, context: conMarca }), legacy);
    }
    assert.equal(guardifyGoverns(supervisor, " 111 "), true);
    assert.equal(guardifyGoverns(supervisor, null), false);
  });

  it("con Guardify manda el permiso del rol, aunque la app dijera otra cosa", () => {
    assert.equal(screenVisible("checklist-supervision", { access: supervisor, cedula: "111", legacy: false, context: conMarca }), true);
    assert.equal(screenVisible("reportes", { access: supervisor, cedula: "111", legacy: true, context: conMarca }), false);
  });

  it("las condiciones de Guardify se evalúan con la marca y la división de la app", () => {
    const ver = (context: Record<string, string | null>) => screenVisible("visitors", { access: supervisor, cedula: "111", legacy: false, context });
    assert.equal(ver(conMarca), true);
    assert.equal(ver(menuContext({ hasCurrentMarca: true, division: "Aseo y Limpieza" })), false);
    assert.equal(ver(sinMarca), false);
    // sin condición (Solicitud de permiso) se ve aunque no haya marca
    assert.equal(screenVisible("permit-request", { access: supervisor, cedula: "111", legacy: false, context: sinMarca }), true);
  });

  it("la liberación del módulo y las reglas de funcionamiento siguen aplicando", () => {
    assert.equal(screenVisible("checklist-supervision", { access: supervisor, cedula: "111", legacy: true, context: conMarca, released: false }), false);
    assert.equal(screenVisible("checklist-supervision", { access: supervisor, cedula: "111", legacy: true, context: conMarca, extra: false }), false);
  });

  it("una pantalla que Guardify no conoce usa la regla de la app", () => {
    assert.equal(screenVisible("pantalla-nueva", { access: supervisor, cedula: "111", legacy: true, context: conMarca }), true);
  });

  it("cada pantalla apunta a un permiso distinto", () => {
    const perms = Object.values(GUARDIFY_SCREENS);
    assert.equal(new Set(perms).size, perms.length);
    assert.equal(perms.length, 41);
  });
});
