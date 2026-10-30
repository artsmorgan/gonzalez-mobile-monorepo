import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { verifyMainStructureAccess } from "../verifyMainStructureAccess";

// Función GET para obtener el archivo
export async function GET(req: NextRequest) {
    try {
        const auth = verifyMainStructureAccess(req);
        if (!auth.ok) {
            return NextResponse.json(auth.body, { status: auth.status });
        }

        console.log(7);
        const outPath = path.resolve(process.cwd(), "main-structure.json");

        console.log(8);
        let data: string;
        try {
            data = await fs.readFile(outPath, "utf8");
        } catch {
            // Cache inexistente: devolvemos vacío para que el cliente pueda regenerar.
            return NextResponse.json(
                { status: false, created_at: null, message: "Cache main-structure.json no existe", structure: JSON.stringify([]) },
                { status: 200 }
            );
        }

        console.log(9);
        let parsed: { created_at: unknown; structure: unknown };
        try {
            parsed = JSON.parse(data);
        } catch (e) {
            // Cache corrupto/truncado: lo movemos a un backup y devolvemos vacío.
            try {
                const corruptPath = `${outPath}.corrupt.${Date.now()}`;
                await fs.rename(outPath, corruptPath);
            } catch {
                await fs.unlink(outPath).catch(() => undefined);
            }

            return NextResponse.json(
                {
                    status: false,
                    created_at: null,
                    message: "Cache main-structure.json inválida (corrupta/truncada). Se requiere regeneración.",
                    structure: JSON.stringify([]),
                },
                { status: 200 }
            );
        }

        console.log(10);
        const { created_at, structure } = parsed;
        console.log(11);
        return NextResponse.json({ status: true, created_at }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("[main-structure] Error al leer main-structure.json:", errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}