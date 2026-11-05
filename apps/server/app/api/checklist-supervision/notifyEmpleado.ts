/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { prisma } from "../../../utils/prismaClient";
import { sendNotificationByEmployee } from "../../../utils/sendNotification";

function parseEvalSections(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toYmd(value: unknown): string | null {
  if (value == null || String(value).trim() === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function formatYmdEs(ymd: string | null): string {
  if (!ymd) return "";
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatEmpleadoNombre(emp: {
  nombre?: string | null;
  primer_apellido?: string | null;
  segundo_apellido?: string | null;
} | null): string {
  if (!emp) return "";
  return [emp.nombre, emp.primer_apellido, emp.segundo_apellido]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function isCarnesSection(sec: any): boolean {
  const id = String(sec?.id ?? "").trim().toLowerCase();
  if (id === "carnes") return true;
  const title = String(sec?.title ?? "").trim().toLowerCase();
  return /carn[eé]s?/.test(title);
}

function isEmpresaCarneSubsection(sub: any): boolean {
  const id = String(sub?.id ?? "").trim().toLowerCase();
  if (id === "car-sub-0") return true;
  const title = String(sub?.title ?? "").trim().toLowerCase();
  return /carn[eé]\s+de\s+la\s+empresa/.test(title);
}

function isLicenciasSection(sec: any): boolean {
  const id = String(sec?.id ?? "").trim().toLowerCase();
  if (id === "licencias") return true;
  const title = String(sec?.title ?? "").trim().toLowerCase();
  return /licencias/.test(title);
}

type ExpiredDocumentItem = { title: string; expiryYmd: string | null };

function collectExpiredDocumentItemsFromSubsections(
  evaluacion: unknown,
  sectionMatcher: (sec: any) => boolean,
  skipSubsection?: (sub: any) => boolean,
): ExpiredDocumentItem[] {
  const items: ExpiredDocumentItem[] = [];
  const seen = new Set<string>();

  for (const sec of parseEvalSections(evaluacion)) {
    if (!sectionMatcher(sec)) continue;
    const subs = Array.isArray(sec?.subsections) ? sec.subsections : [];
    for (const sub of subs) {
      if (skipSubsection?.(sub)) continue;
      const title = String(sub?.title ?? "").trim() || "Documento";
      const inputs = Array.isArray(sub?.inputs) ? sub.inputs : [];
      const select = inputs.find((inp: any) => String(inp?.type ?? "").toLowerCase() === "select");
      const dateInp = inputs.find(
        (inp: any) =>
          String(inp?.type ?? "").toLowerCase() === "date" ||
          String(inp?.id ?? "").includes("fecha-vencimiento"),
      );
      const selectVal = String(select?.value ?? "").trim().toLowerCase();
      if (selectVal !== "vencido") continue;
      if (seen.has(title)) continue;
      seen.add(title);
      items.push({ title, expiryYmd: dateInp ? toYmd(dateInp.value) : null });
    }
  }
  return items;
}

/** Carnés vencidos según estado del select (Vigente / Vencido). Excluye "Carne de la empresa" (Bueno/Malo, sin aviso). */
export function collectExpiredCarnes(evaluacion: unknown): ExpiredDocumentItem[] {
  return collectExpiredDocumentItemsFromSubsections(
    evaluacion,
    isCarnesSection,
    isEmpresaCarneSubsection,
  );
}

/** Licencias vencidas según estado del select (Vigente / Vencido / No aplica). */
export function collectExpiredLicencias(evaluacion: unknown): ExpiredDocumentItem[] {
  return collectExpiredDocumentItemsFromSubsections(evaluacion, isLicenciasSection);
}

function formatExpiredDocumentLabel(item: ExpiredDocumentItem): string {
  const fecha = formatYmdEs(item.expiryYmd);
  return fecha ? `${item.title} (vencimiento: ${fecha})` : item.title;
}

function appendExpiredDocumentsMessage(description: string, labels: string[], singular: string, plural: string): string {
  if (labels.length === 1) {
    return `${description} ${singular}: ${labels[0]}.`;
  }
  if (labels.length > 1) {
    const last = labels[labels.length - 1];
    const rest = labels.slice(0, -1).join(", ");
    return `${description} ${plural}: ${rest} y ${last}.`;
  }
  return description;
}

export async function notifyChecklistSupervisionEmpleado(opts: {
  req: NextRequest;
  empleadoId: number | null | undefined;
  corpoId: number;
  puestoId: number;
  fechaRegistro: Date | string;
  evaluacion: unknown;
  createdByEmpleadoId?: number | null;
}): Promise<void> {
  const empleadoId = Number(opts.empleadoId);
  if (!Number.isFinite(empleadoId) || empleadoId <= 0) return;

  const [empleado, puesto, sucursal, creador] = await Promise.all([
    prisma.c_empleado.findUnique({
      where: { id: empleadoId },
      select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true },
    }),
    Number.isFinite(opts.puestoId) && opts.puestoId > 0
      ? prisma.e_estructura_puesto.findUnique({
          where: { id: opts.puestoId },
          select: { nombre: true, codigo: true },
        })
      : Promise.resolve(null),
    Number.isFinite(opts.corpoId) && opts.corpoId > 0
      ? prisma.e_estructura_sucursal.findUnique({
          where: { id: opts.corpoId },
          select: { nombre: true },
        })
      : Promise.resolve(null),
    Number.isFinite(Number(opts.createdByEmpleadoId)) && Number(opts.createdByEmpleadoId) > 0
      ? prisma.c_empleado.findUnique({
          where: { id: Number(opts.createdByEmpleadoId) },
          select: { nombre: true, primer_apellido: true, segundo_apellido: true },
        })
      : Promise.resolve(null),
  ]);

  const puestoNombre = puesto
    ? `${puesto.nombre}${puesto.codigo ? ` (${puesto.codigo})` : ""}`
    : "el puesto";
  const sucursalNombre = sucursal?.nombre?.trim() || "la sucursal";
  const fechaTxt = formatYmdEs(toYmd(opts.fechaRegistro)) || "la fecha del registro";
  const creadorNombre = formatEmpleadoNombre(creador);
  const evaluadoNombre = formatEmpleadoNombre(empleado);

  const expiredCarnes = collectExpiredCarnes(opts.evaluacion).map(formatExpiredDocumentLabel);
  const expiredLicencias = collectExpiredLicencias(opts.evaluacion).map(formatExpiredDocumentLabel);

  let description = creadorNombre
    ? `${creadorNombre} registró un checklist de supervisión${evaluadoNombre ? ` a nombre de ${evaluadoNombre}` : ""} en el puesto ${puestoNombre} de la sucursal ${sucursalNombre} el día ${fechaTxt}.`
    : `Se registró un checklist de supervisión${evaluadoNombre ? ` a nombre de ${evaluadoNombre}` : ""} en el puesto ${puestoNombre} de la sucursal ${sucursalNombre} el día ${fechaTxt}.`;

  description = appendExpiredDocumentsMessage(
    description,
    expiredCarnes,
    "El siguiente carné está vencido",
    "Los siguientes carnés están vencidos",
  );
  description = appendExpiredDocumentsMessage(
    description,
    expiredLicencias,
    "La siguiente licencia está vencida",
    "Las siguientes licencias están vencidas",
  );

  // Lista de exclusión vacía: notificar siempre a empleado_id, incluso si es el mismo que registra.
  await sendNotificationByEmployee(opts.req, opts.corpoId, [], "Checklist de supervisión registrado", description, [
    empleadoId,
  ]);
}
