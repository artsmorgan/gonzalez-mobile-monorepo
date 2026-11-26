const jwt = require("jsonwebtoken");

export const verifyTokenFromBody = (token?: string) => {
    try {
        if (!token || String(token).trim().length === 0) {
            return { valid: false, expired: false, payload: null, message: "Token no proporcionado" };
        }
        const decoded = jwt.verify(String(token), process.env.JWT_SECRET);
        return { valid: true, expired: false, payload: decoded, message: "Token válido" };
    } catch (error: any) {
        if (error?.name === "TokenExpiredError") {
            return { valid: false, expired: true, payload: null, message: "Token expirado" };
        }
        return { valid: false, expired: false, payload: null, message: "Token inválido" };
    }
};