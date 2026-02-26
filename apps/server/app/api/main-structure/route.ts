import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        // Extraer el token JWT real del header Authorization
        const authHeader = req.headers.get("authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";

        const response = await axios.post(
            `${process.env.SERVER_URL}/api/dynamic-prisma/main-structure`,
            {
                token: token,
                mobileAccessToken: process.env.MOBILE_ACCESS_TOKEN,
                shouldVerifyAccessToken: true,
            },
            {
                headers: {
                    Authorization: authHeader,
                    "Content-Type": "application/json",
                },
            }
        );
        const data = response.data;

        if (!data.status) {
            return NextResponse.json({ status: false, structure: [], message: data.message }, { status: 500 });
        }

        return NextResponse.json({ status: true, structure: data.structure }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}