export type MobileTokenPayload = {
    id: number;
    cedula: string | null;
    sessionId?: string;
    username?: string;
    roles?: string[];
    iat?: number;
    exp?: number;
    tokenType: "planillas" | "legacy";
};

export type MobileTokenValidation = {
    valid: boolean;
    expired: boolean;
    payload: MobileTokenPayload | null;
    message: string;
};

export type PlanillasJwtPayload = {
    roles?: string[];
    username?: string;
    iat?: number;
    exp?: number;
};
