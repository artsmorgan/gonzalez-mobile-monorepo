import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const serverUrl = process.env.SERVER_URL?.trim();
    const baseUrl =
      serverUrl && serverUrl.length > 0
        ? serverUrl.replace(/\/+$/, '')
        : request.nextUrl.origin;

    const authHeader = request.headers.get('authorization') || '';

    const response = await axios.post(
      `${baseUrl}/api/dynamic-prisma/auth/logout`,
      body,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }
    );

    const data = response.data;
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Error proxying auth/logout to dynamic-prisma:', error?.message || error);
    return NextResponse.json(
      { status: false, message: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

