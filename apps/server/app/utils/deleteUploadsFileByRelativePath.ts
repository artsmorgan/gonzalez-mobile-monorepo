import fs from "fs";
import path from "path";

/**
 * Elimina un archivo bajo `public/uploads` a partir de una ruta relativa
 * (p. ej. `attendance-control/12/foto.jpg`). Misma semántica que DELETE en
 * `api/dynamic-prisma/files`.
 */
export function deleteUploadsFileByRelativePath(inputPath: string): { ok: boolean; message?: string } {
  try {
    const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
    let cleaned = decodeURIComponent(String(inputPath || ""))
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .trim();
    if (cleaned.startsWith("public/")) {
      cleaned = cleaned.slice("public/".length);
    }
    if (cleaned.startsWith("uploads/")) {
      cleaned = cleaned.slice("uploads/".length);
    }

    const normalizedPosix = path.posix.normalize(cleaned);
    if (
      normalizedPosix === "." ||
      normalizedPosix.startsWith("../") ||
      normalizedPosix.includes("/../") ||
      normalizedPosix.includes("\0")
    ) {
      return { ok: false, message: "Ruta inválida" };
    }

    const absolutePath = path.resolve(uploadsRoot, ...normalizedPosix.split("/"));
    if (!(absolutePath === uploadsRoot || absolutePath.startsWith(`${uploadsRoot}${path.sep}`))) {
      return { ok: false, message: "Ruta fuera del directorio permitido" };
    }

    if (!fs.existsSync(absolutePath)) {
      return { ok: true };
    }

    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      return { ok: false, message: "Solo se permite eliminar archivos, no carpetas" };
    }

    fs.unlinkSync(absolutePath);
    return { ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al eliminar archivo";
    return { ok: false, message };
  }
}
