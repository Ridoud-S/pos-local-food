import { toast } from "sonner"

export class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
        super(message)
        this.status = status
    }
}

let onUnauthorizedHandler: (() => void) | null = null

export function setOnUnauthorized(handler: () => void) {
    onUnauthorizedHandler = handler
}

type Opts = Omit<RequestInit, "body"> & { json?: unknown }

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
    const { json, headers, ...rest } = opts
    const res = await fetch(`/api${path}`, {
        ...rest,
        credentials: "same-origin",
        headers: {
            ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
            ...headers,
        },
        body: json !== undefined ? JSON.stringify(json) : undefined,
    })
    if (res.status === 204) return undefined as T
    const data = await res.json().catch(() => null)
    if (!res.ok) {
        if (res.status === 401) {
            // Limpia sesión y manda a /login
            if (path !== "/me" || window.location.pathname !== "/login") {
                if (onUnauthorizedHandler) {
                    onUnauthorizedHandler()
                } else if (window.location.pathname !== "/login") {
                    window.location.href = "/login"
                }
            }
        } else if (res.status === 403) {
            toast.error("No tienes permiso")
        }
        throw new ApiError(res.status, data?.error ?? "Error de conexión")
    }
    return data as T
}
