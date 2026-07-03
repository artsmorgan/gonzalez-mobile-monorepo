import axios from "axios";
import { prisma } from "./prismaClient";
import { toZonedTime } from "date-fns-tz";

export async function createTokenPlanillas(empleado_id: number, password: string) {
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
    //now = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    let expires_at = new Date(now.getTime() + response.data.data.expires_in * 1000);
  
    let mobile_token = await prisma.a_mobile_token_for_planillas.findFirst({
      where: { empleado_id: empleado_id }
    });
  
    let planillasToken = response.data.data.token;
  
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
  
    return { planillasToken: planillasToken, planillasTokenExpiresAt: expires_at.getTime() };
  }