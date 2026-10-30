import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildCorporateVehicleCreateFromBitacora,
    buildCorporateVehicleOptionalFields,
    optionalVehicleText,
    VEHICLE_DOC_NUM_MAX,
    VEHICLE_VIN_MAX,
} from "./corporateVehiclePayload";

describe("vehículo corporativo: VIN y datos de documentos (issues #139 y #143)", () => {
    it("recorta y limita el texto opcional; vacío es null", () => {
        assert.equal(optionalVehicleText("  ABC  ", 10), "ABC");
        assert.equal(optionalVehicleText("", 10), null);
        assert.equal(optionalVehicleText(null, 10), null);
        assert.equal(optionalVehicleText("x".repeat(80), VEHICLE_VIN_MAX)!.length, VEHICLE_VIN_MAX);
        assert.equal(optionalVehicleText("x".repeat(300), VEHICLE_DOC_NUM_MAX)!.length, VEHICLE_DOC_NUM_MAX);
    });
    it("un vehículo guarda el VIN y los datos de sus documentos, sin tocar los Sí/No", () => {
        const o = buildCorporateVehicleOptionalFields({ tipo: "Vehículo", placa: "ABC-1", titulo_propiedad: true, rtv: false, vin: "9BWZZZ377VT004251", titulo_propiedad_num: "TP-1", rtv_num: " R-2 ", marchamo_num: "" });
        assert.deepEqual([o.vin, o.titulo_propiedad_num, o.rtv_num, o.marchamo_num], ["9BWZZZ377VT004251", "TP-1", "R-2", null]);
        assert.deepEqual([o.titulo_propiedad, o.rtv, o.marchamo], [true, false, null]);
    });
    it("una bicicleta no lleva VIN ni datos de documentos", () => {
        const o = buildCorporateVehicleOptionalFields({ tipo: "Bicicleta", vin: "X", titulo_propiedad_num: "Y", rtv_num: "Z", marchamo_num: "W" });
        assert.deepEqual([o.vin, o.titulo_propiedad_num, o.rtv_num, o.marchamo_num], [null, null, null, null]);
    });
    it("sin los campos nuevos (petición de una app anterior o acción offline vieja) quedan vacíos y no falla", () => {
        const o = buildCorporateVehicleOptionalFields({ tipo: "Vehículo", placa: "ABC-1" });
        assert.deepEqual([o.vin, o.titulo_propiedad_num, o.rtv_num, o.marchamo_num], [null, null, null, null]);
    });
    it("el vehículo creado desde la revisión (bitácora) conserva el VIN y los datos", () => {
        const data = buildCorporateVehicleCreateFromBitacora(
            { tipo: "Vehículo", marca: "Toyota", placa: "ABC-1", tipo_autoria: "Cliente", vin: "VIN1", rtv_num: "R-9" },
            { empresa_id: 1, cliente_id: 2, sucursal_id: 3, firma_responsable: "f", created_by: 4, created_at: "2026-10-20T00:00:00.000Z" },
        );
        assert.deepEqual([data.vin, data.rtv_num, data.titulo_propiedad_num], ["VIN1", "R-9", null]);
    });
});
