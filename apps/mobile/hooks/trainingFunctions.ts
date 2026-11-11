import Constants from "expo-constants";
import authedFetch from "./authedFetch";

interface AuthHandlers {
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

function apiBase() {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
        throw new Error("Server URL not configured");
    }
    return apiUrl;
}

export async function createTraining({
    requestData,
    marcaId,
    refreshAccessToken,
    logout,
}: {
    requestData: any;
    marcaId: number;
} & AuthHandlers) {
    try {
        if (!marcaId) {
            throw new Error("Marca ID not found");
        }
        if (!refreshAccessToken || !logout) {
            throw new Error("Auth handlers not provided");
        }
        const response = await authedFetch({
            url: `${apiBase()}/api/training`,
            init: {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestData),
            },
            refreshAccessToken,
            logout,
        });
        if (!response) {
            return { status: false, message: "Sesión expirada" };
        }
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error creating training:", error);
        return { status: false, message: "Error al crear la capacitación" };
    }
}

export async function updateTraining({
    trainingId,
    requestData,
    refreshAccessToken,
    logout,
}: {
    trainingId: number;
    requestData: any;
} & AuthHandlers) {
    try {
        if (!refreshAccessToken || !logout) {
            throw new Error("Auth handlers not provided");
        }
        const response = await authedFetch({
            url: `${apiBase()}/api/training/${trainingId}`,
            init: {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestData),
            },
            refreshAccessToken,
            logout,
        });
        if (!response) {
            return { status: false, message: "Sesión expirada" };
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                status: false,
                message: (data as { message?: string })?.message || `Error ${response.status}`,
            };
        }
        return data;
    } catch (error) {
        console.error("Error updating training:", error);
        return { status: false, message: "Error al actualizar la capacitación" };
    }
}

export async function deleteTraining({
    trainingId,
    refreshAccessToken,
    logout,
}: {
    trainingId: number;
} & AuthHandlers) {
    try {
        if (!refreshAccessToken || !logout) {
            throw new Error("Auth handlers not provided");
        }
        const response = await authedFetch({
            url: `${apiBase()}/api/training/${trainingId}`,
            init: { method: "DELETE" },
            refreshAccessToken,
            logout,
        });
        if (!response) {
            return { status: false, message: "Sesión expirada" };
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                status: false,
                message: (data as { message?: string })?.message || `Error ${response.status}`,
            };
        }
        return data;
    } catch (error) {
        console.error("Error deleting training:", error);
        return { status: false, message: "Error al eliminar la capacitación" };
    }
}

export async function deleteTrainingArchivo({
    trainingId,
    fileName,
    refreshAccessToken,
    logout,
}: {
    trainingId: number;
    fileName: string;
} & AuthHandlers) {
    try {
        if (!refreshAccessToken || !logout) {
            throw new Error("Auth handlers not provided");
        }
        const q = `name=${encodeURIComponent(fileName)}`;
        const response = await authedFetch({
            url: `${apiBase()}/api/training/${trainingId}/archivo?${q}`,
            init: { method: "DELETE" },
            refreshAccessToken,
            logout,
        });
        if (!response) {
            return { status: false, message: "Sesión expirada" };
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                status: false,
                message: (data as { message?: string })?.message || `Error ${response.status}`,
            };
        }
        return data;
    } catch (error) {
        console.error("Error deleting training archivo:", error);
        return { status: false, message: "Error al eliminar el archivo" };
    }
}
