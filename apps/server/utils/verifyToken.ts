import { NextRequest, NextResponse } from "next/server";
const jwt = require("jsonwebtoken");

export function verifyAccessToken(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return { valid: false, expired: false, payload: null, message: "Token no proporcionado" };
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        return { valid: true, expired: false, payload: decoded, message: "Token válido" };
    } catch (error: any) {
        console.log(error);
        if (error.name === "TokenExpiredError") {
            return { valid: false, expired: true, payload: null, message: "Token expirado" };
        }

        return { valid: false, expired: false, payload: null, message: "Token inválido" };
    }
}
