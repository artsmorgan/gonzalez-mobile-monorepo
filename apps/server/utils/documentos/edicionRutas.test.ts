import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { stripComments } from "../routeAudit";

const server = path.join(__dirname, "..", "..");
const leer = (rel: string) => stripComments(fs.readFileSync(path.join(server, rel), "utf8"));
const antes = (src: string, a: string, b: string) => {
    const i = src.indexOf(a);
    const j = src.indexOf(b);
    assert.ok(i >= 0, `no está «${a}»`);
    assert.ok(j >= 0, `no está «${b}»`);
    assert.ok(i < j, `«${a}» debe ir antes que «${b}»`);
};

describe("rutas de edición de documentos: el cableado que no se puede romper", () => {
    const edit = leer("app/api/job-manuals/[id]/edit/route.ts");
    const borrar = leer("app/api/job-manuals/[id]/files/[fileId]/route.ts");

    it("editar: verifica sesión, valida y comprueba permiso (rol y marca) ANTES de leer o escribir el documento", () => {
        antes(edit, "verifyAccessTokenByApi(req)", "validarEdicion(body)");
        antes(edit, "validarEdicion(body)", "autorizarGestionManual(");
        antes(edit, "autorizarGestionManual(", 'table: "e_manual_puesto", operation: "findUnique"');
        antes(edit, "autorizarGestionManual(", "uploadDynamicFiles(");
        antes(edit, "autorizarGestionManual(", "aplicarEdicionManual(");
        assert.match(edit, /roleNameOfMarca: \(m\) => rolDeMarca\(req, m\)/);
        assert.match(edit, /isAdmin: \(\) => isSuperAdminEmpleado\(req, Number\(payload\?\.id\)\)/);
    });
    it("editar: el quiz modificado sin nueva versión se rechaza ANTES de subir archivos, y los archivos huérfanos se limpian si algo falla", () => {
        antes(edit, "quiz_requires_new_version", "uploadDynamicFiles(");
        antes(edit, "uploadDynamicFiles(", "aplicarEdicionManual(");
        assert.match(edit, /subidosParaLimpiar/);
        assert.match(edit, /deleteDynamicFile\(\{ req, url: `job-manuals\/\$\{manualId\}\/\$\{name\}` \}\)/);
    });
    it("editar: la notificación solo sale con nueva versión y un fallo al avisar no deshace la edición; la bitácora también es no fatal", () => {
        const i = edit.indexOf("if (resultado.versionCambio) {");
        assert.ok(i > 0);
        const bloque = edit.slice(i, edit.indexOf("return NextResponse.json(", i));
        assert.match(bloque, /sendNotificationByPlaza\(/);
        assert.match(bloque, /sendNotificationByEmployee\(/);
        assert.match(bloque, /catch \(e\)/);
        assert.equal(/sendNotificationBy(Plaza|Employee)\(/.test(edit.slice(0, i)), false, "ninguna notificación fuera de la nueva versión");
        assert.match(edit, /table: "c_cambios_apps_modules"/);
        assert.match(edit, /nombre_tabla: "e_manual_puesto"/);
    });
    it("si el almacenamiento de archivos (S3) rechaza la subida: nada se escribe, se responde 502 claro y el detalle real queda en el registro de errores", () => {
        const i = edit.indexOf("uploadDynamicFiles({");
        assert.ok(i > 0);
        assert.match(edit.slice(i - 40, i + 900), /try \{[\s\S]*uploadDynamicFiles[\s\S]*catch \(e\)[\s\S]*reportError\(req, ENDPOINT, "PUT", 502[\s\S]*storage_unavailable[\s\S]*status: 502/);
        antes(edit, "storage_unavailable", "aplicarEdicionManual(");
    });
    it("borrar un archivo: permiso antes de tocar nada, el archivo debe ser de ese documento, y borra la fila y el archivo del almacén al instante", () => {
        antes(borrar, "verifyAccessTokenByApi(req)", "autorizarGestionManual(");
        antes(borrar, "autorizarGestionManual(", 'table: "e_archivos_manual_puesto", operation: "findFirst"');
        assert.match(borrar, /where: \{ id: fileId, manual_puesto_id: manualId \}/);
        antes(borrar, 'operation: "findFirst"', 'operation: "deleteMany"');
        antes(borrar, 'operation: "deleteMany"', "deleteDynamicFile(");
        assert.match(borrar, /searchParams\.get\("marca_id"\)/);
        assert.match(borrar, /prop: "archivo_eliminado"/);
        assert.equal(/nueva_version|publicarNuevaVersion/.test(borrar), false, "borrar un archivo no cambia la versión");
    });
    it("un fallo del almacén de archivos no deshace el borrado de la fila (mejor esfuerzo)", () => {
        const i = borrar.indexOf("deleteDynamicFile(");
        assert.match(borrar.slice(i - 80, i + 260), /try \{[\s\S]*deleteDynamicFile[\s\S]*catch/);
        assert.match(borrar, /almacenLimpio = false/, "se informa que el archivo quedó en el almacenamiento");
        assert.match(borrar, /reportError\(req, ENDPOINT, "DELETE", 502/, "y se deja constancia para limpiarlo");
    });
    it("ninguna de las dos acepta el rol ni el permiso desde el cuerpo: el rol sale de la marca en el servidor", () => {
        for (const src of [edit, borrar]) {
            assert.equal(/body\??\.role|role_name|roleName\b/.test(src), false);
            assert.match(src, /rolDeMarca\(req, m\)/);
        }
    });
});
