import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { AdminCatalogo, Categoria, DiaStats, Orden, TopProducto, Usuario } from "@/lib/types"

export function useMenu() {
    return useQuery({
        queryKey: ["menu"],
        queryFn: () => api<Categoria[]>("/menu"),
    })
}

export function useCatalogo() {
    return useQuery({
        queryKey: ["catalogo"],
        queryFn: () => api<AdminCatalogo>("/admin/catalogo"),
    })
}

export function usePorCobrar() {
    return useQuery({
        queryKey: ["orders", "por-cobrar"],
        queryFn: () => api<Orden[]>("/orders?estado_pago=pendiente"),
        refetchInterval: 5000,
    })
}

export const usePedidosActivos = () =>
    useQuery({
        queryKey: ["orders", "activos"],
        queryFn: () => api<Orden[]>("/orders?vista=cocina"),
        refetchInterval: 4000,
    })

export const useTablero = () =>
    useQuery({
        queryKey: ["orders", "tablero"],
        queryFn: () => api<Orden[]>("/orders?vista=cocina"),
        refetchInterval: 3000,
    })

export const useStatsDias = (dias: number) =>
    useQuery({
        queryKey: ["stats", "dias", dias],
        queryFn: () => api<DiaStats[]>(`/stats/dias?dias=${dias}`),
        refetchInterval: 10_000,
    })

export const useStatsTop = (dias: number) =>
    useQuery({
        queryKey: ["stats", "top", dias],
        queryFn: () => api<TopProducto[]>(`/stats/top?dias=${dias}`),
        refetchInterval: 30_000,
    })

export const useUsuarios = () =>
    useQuery({
        queryKey: ["usuarios"],
        queryFn: () => api<Usuario[]>("/admin/usuarios"),
    })
