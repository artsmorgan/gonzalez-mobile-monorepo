/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { prisma } from "../../../../utils/prismaClient";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const body = await req.json();
    const codigosRaw = body?.codigos;
    if (!Array.isArray(codigosRaw) || codigosRaw.length === 0) {
      return NextResponse.json(
        { status: false, message: "Debe indicar al menos un código de puesto." },
        { status: 200 },
      );
    }

    const codigos = Array.from(
      new Set(
        codigosRaw
          .map((c: unknown) => String(c ?? "").trim())
          .filter((c: string) => c.length > 0),
      ),
    );
    if (codigos.length === 0) {
      return NextResponse.json(
        { status: false, message: "Códigos de puesto inválidos." },
        { status: 200 },
      );
    }

    const puestos = await prisma.e_estructura_puesto.findMany({
      where: { codigo: { in: codigos } },
    });

    const puestoByCodigo = new Map<string, { id: number; codigo: string; nombre: string }>();
    for (const p of Array.isArray(puestos) ? puestos : []) {
      const codigo = String(p.codigo ?? "").trim();
      if (!codigo) continue;
      puestoByCodigo.set(codigo, {
        id: Number(p.id),
        codigo,
        nombre: String(p.nombre ?? ""),
      });
    }

    const errors: string[] = [];
    const resolved: { codigo: string; id: number; nombre: string }[] = [];
    for (const codigo of codigos) {
      const puesto = puestoByCodigo.get(codigo);
      if (!puesto) {
        errors.push(`El código de puesto «${codigo}» no existe.`);
        continue;
      }
      resolved.push(puesto);
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          status: false,
          message: "Algunos códigos de puesto no existen.",
          errors,
          puestos: resolved,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: `${resolved.length} código(s) de puesto válido(s).`,
        puestos: resolved,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/mantenimiento-equipo/validar-puestos-codigos:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
