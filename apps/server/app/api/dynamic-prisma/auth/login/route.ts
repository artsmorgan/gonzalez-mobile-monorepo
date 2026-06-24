/* Auth login route using Prisma directly (no callDynamicPrisma) */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { toZonedTime } from 'date-fns-tz';
import { prisma } from '../../../../../utils/prismaClient';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt');
import crypto from 'crypto';
import axios from 'axios';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cedula, password, deviceName } = body;

    console.log('deviceName', deviceName);

    if (!cedula || !password) {
      return NextResponse.json(
        { status: false, message: 'Cédula y contraseña son requeridos' },
        { status: 400 }
      );
    }

    const empleado = await prisma.c_empleado.findFirst({ where: { cedula } });

    if (!empleado) {
      return NextResponse.json(
        { status: false, message: 'Empleado inválido' },
        { status: 401 }
      );
    }

    if (!empleado.password) {
      return NextResponse.json(
        { status: false, message: 'Contraseña inválida' },
        { status: 401 }
      );
    }

    if (empleado.fecha_contratacion == null) {
      return NextResponse.json(
        { status: false, message: 'Empleado no ha sido contratado' },
        { status: 401 }
      );
    }

    if (empleado.estado === 'BA') {
      return NextResponse.json(
        { status: false, message: 'Empleado fue dado de baja' },
        { status: 401 }
      );
    }

    const passwordExpiresAt = empleado.password_expires_at ? new Date(empleado.password_expires_at) : null;
    if (passwordExpiresAt && passwordExpiresAt < toZonedTime(new Date(), 'America/Costa_Rica')) {
      return NextResponse.json(
        { status: false, passwordExpired: true, message: 'Contraseña expirada, debe cambiarla' },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, empleado.password);

    if (!passwordMatch) {
      return NextResponse.json(
        { status: false, message: 'La contraseña es incorrecta' },
        { status: 401 }
      );
    }

    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT secrets not configured');
    }

    const sessionId = uuidv4();

    const accessToken = jwt.sign(
      { id: empleado.id, cedula: empleado.cedula, sessionId },
      process.env.JWT_SECRET!,
      { expiresIn: '1d' }
    );

    const refreshToken = jwt.sign(
      { id: empleado.id, sessionId },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );

    const now = toZonedTime(new Date(), 'America/Costa_Rica');

    // Revocar tokens anteriores del empleado
    await prisma.refresh_token.updateMany({
      where: { empleadoId: empleado.id },
      data: { revoked: true },
    });

    // Registrar nuevo refresh token
    await prisma.refresh_token.create({
      data: {
        token: hashToken(refreshToken),
        empleadoId: empleado.id,
        sessionId,
        createdAt: now,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        device: deviceName,
        revoked: false,
      },
    });

    await prisma.c_login_marca_almuerzo.create({
      data: {
        nombre_empleado: (empleado.nombre || "") + " " + (empleado.primer_apellido || "") + " " + (empleado.segundo_apellido || ""),
        cedula_empleado: empleado.cedula || "",
        fecha_hora: now,
        device: deviceName,
        session_id: sessionId,
      },
    });

    // Construir roles del empleado (misma lógica que la ruta original, pero con Prisma)
    const empleadoPlazas = await prisma.c_empleado_plaza.findMany({
      where: { empleado_id: empleado.id },
    });

    const roles: { role: { name: string; id: number }; division: { id: number; name: string } }[] = [];

    for (const item of empleadoPlazas) {
      if (!item.plaza_id || !item.division_id) continue;

      const division = await prisma.n_division.findFirst({ where: { id: item.division_id } });
      if (!division) continue;

      const plaza = await prisma.e_estructura_plazas.findFirst({ where: { id: item.plaza_id } });
      if (!plaza || !plaza.categoriaSalarial_id) continue;

      const categoria_salarial = await prisma.pg_categoria_salarial.findFirst({
        where: { id: plaza.categoriaSalarial_id },
      });
      if (!categoria_salarial || !categoria_salarial.categoriaEmpleado_id) continue;

      const categoria_empleado = await prisma.pg_categoria_empleado.findFirst({
        where: { id: categoria_salarial.categoriaEmpleado_id },
      });
      if (!categoria_empleado) continue;

      let roleName = 'OPERATIVO';
      switch (categoria_empleado.codigo) {
          case "OFI":
              roleName = "OPERATIVO";
              break;
          case "MIS":
              roleName = "OPERATIVO";
              break;
          case "ADM":
              roleName = "ADMINISTRATIVO";
              break;
          case "COO":
              roleName = "SUPERVISOR";
              break;
          case "SUP":
              roleName = "SUPERVISOR";
              break;
          case "OFC":
              roleName = "OPERATIVO";
              break;
      }

      const existing = roles.find(
        (r) => r.role.id === categoria_empleado.id && r.division.id === item.division_id
      );
      if (existing) continue;

      roles.push({
        role: { name: roleName, id: categoria_empleado.id },
        division: { id: item.division_id, name: division.nombre },
      });
    }

    await createTokenPlanillas(empleado.id, password);

    return NextResponse.json(
      {
        status: true,
        message: 'Logeado con éxito',
        accessToken,
        refreshToken,
        createdAt: now.getTime(),
        empleado: {
          id: empleado.id,
          cedula: empleado.cedula,
          nombre: empleado.nombre,
          apellido: empleado.primer_apellido,
          segundo_apellido: empleado.segundo_apellido,
          email: empleado.Email,
          telefono: empleado.telefono,
          tipoCedula: empleado.tipoCedula,
          fechaContratacion: empleado.fecha_contratacion,
          firmaManual: empleado.firma_manual,
          roles,
          supervisor_id: empleado.supervisor_id,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error en login (dynamic-prisma/auth):', error);
    return NextResponse.json(
      { status: false, message: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

async function createTokenPlanillas(empleado_id: number, password: string) {
  const planillasUrl = process.env.PLANILLAS_URL;
  if (!planillasUrl) {
      throw new Error("PLANILLAS_URL no configurado");
  }
  const empleado = await prisma.c_empleado.findFirst({
    where: { id: empleado_id }
    });

  if (!empleado) {
    throw new Error("Empleado no encontrado");
  }

  const url = `${planillasUrl}/login`;
  console.log('url', url);
  const response = await axios.post(url, {
    username: empleado.cedula,
    password: password
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.data.success) {
    throw new Error("Error al iniciar sesión en Planillas");
  }

  let now = toZonedTime(new Date(), "America/Costa_Rica");
  now = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  let expires_at = new Date(now.getTime() + response.data.data.expires_in * 1000);

  let mobile_token = await prisma.a_mobile_token_for_planillas.findFirst({
    where: { empleado_id: empleado_id }
  });

  if (mobile_token) {
      await prisma.a_mobile_token_for_planillas.update({
        where: { id: mobile_token.id },
        data: { token: response.data.data.token, created_at: now, expires_at: expires_at }
      });
  }
  else {
      await prisma.a_mobile_token_for_planillas.create({
        data: { empleado_id: empleado_id, token: response.data.data.token, created_at: now, expires_at: expires_at }
      });
  }
}