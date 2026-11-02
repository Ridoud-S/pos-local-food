import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Me } from "@/lib/types"

export function useMe() {
    return useQuery({
        queryKey: ["me"],
        queryFn: () => api<Me>("/me"),
        retry: false,
        staleTime: 5 * 60_000,
    })
}

export function useLogin() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (v: { usuario: string; password: string }) =>
            api<Me>("/auth/login", { method: "POST", json: v }),
        onSuccess: (me) => qc.setQueryData(["me"], me),
    })
}

export function useLogout() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
        onSuccess: () => qc.clear(),
    })
}