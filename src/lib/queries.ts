import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Categoria, DiaStats, Orden, TopProducto } from "@/lib/types"

export function useMenu() {
    return useQuery({
        queryKey: ["menu"],
        queryFn: () => api<Categoria[]>("/menu"),
    })
}

export function usePorCobrar() {
    return useQuery({
        queryKey: ["orders", "por-cobrar"],
        queryFn: () => api<Orden[]>("/orders?estado_pago=pendiente"),
        refetchInterval: 5000,
    })
}

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
