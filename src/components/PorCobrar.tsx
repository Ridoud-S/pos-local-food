import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import PayDialog from "@/components/PayDialog"
import { api } from "@/lib/api"
import { pesos } from "@/lib/format"
import { usePorCobrar } from "@/lib/queries"

export default function PorCobrar() {
    const qc = useQueryClient()
    const { data, isLoading } = usePorCobrar()
    const [cobrar, setCobrar] = useState<{ id: number; total: number } | null>(null)

    const cancelar = useMutation({
        mutationFn: (id: number) => api(`/orders/${id}/cancelar`, { method: "PATCH" }),
        onSuccess: (_r, id) => {
            toast.success(`Pedido #${id} cancelado`)
            qc.invalidateQueries({ queryKey: ["orders"] })
        },
        onError: (e) => toast.error(e.message),
    })

    if (isLoading) return <p className="p-4 text-muted-foreground">Cargando...</p>
    if (!data?.length)
        return <p className="p-8 text-center text-muted-foreground">No hay pedidos por cobrar</p>

    return (
        <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((o) => (
                <div key={o.id} className="flex flex-col gap-3 rounded-lg border p-3">
                    <div className="flex items-baseline justify-between">
                        <span className="text-lg font-semibold">Pedido #{o.id}</span>
                        <span className="text-2xl font-bold">{pesos(o.total_centavos)}</span>
                    </div>
                    <ul className="flex-1 space-y-1 text-sm">
                        {o.items.map((it, i) => (
                            <li key={i}>
                                <span className="font-medium">
                                    {it.cantidad}× {it.nombre}
                                </span>
                                {it.opciones.length > 0 && (
                                    <span className="text-muted-foreground">
                                        {" "}
                                        · {it.opciones.map((x) => x.nombre).join(", ")}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                        <Button
                            className="h-12"
                            onClick={() => setCobrar({ id: o.id, total: o.total_centavos })}
                        >
                            Cobrar
                        </Button>
                        <Button
                            variant="outline"
                            className="h-12"
                            disabled={cancelar.isPending}
                            onClick={() => {
                                if (window.confirm(`¿Cancelar el pedido #${o.id}?`)) cancelar.mutate(o.id)
                            }}
                        >
                            Cancelar
                        </Button>
                    </div>
                </div>
            ))}
            {cobrar && <PayDialog orden={cobrar} onClose={() => setCobrar(null)} />}
        </div>
    )
}