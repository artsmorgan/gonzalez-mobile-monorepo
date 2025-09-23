import { NextRequest, NextResponse } from "next/server";
const jwt = require("jsonwebtoken");

export function verifyAccessToken(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return { valid: false, message: "Token no proporcionado" };
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        return { valid: true, payload: decoded };
    } catch (error) {
        return { valid: false, message: "Token inválido o expirado" };
    }
}
