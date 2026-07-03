import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(request: NextRequest) {
  console.log('Llegamos a planillas token');
    try {
        const body = await request.json();
    
        const serverUrl = process.env.SERVER_URL?.trim();
        const baseUrl =
          serverUrl && serverUrl.length > 0
            ? serverUrl.replace(/\/+$/, '')
            : request.nextUrl.origin;
    
        const authHeader = request.headers.get('authorization') || '';
    
        const url = `${baseUrl}/api/dynamic-prisma/auth/planillas-token`;
    
        const response = await axios.post(url, body, {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json'
          },
          validateStatus: () => true,
        });
    
        if (response.status !== 200) {
            return NextResponse.json({ status: false, message: "Error al obtener el token de Planillas" }, { status: response.status });
        }

        const data = response.data;

        return NextResponse.json({ status: data.status, data: data }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}