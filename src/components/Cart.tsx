import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Minus, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import PayDialog from "@/components/PayDialog"
import { api } from "@/lib/api"
import { pesos } from "@/lib/format"
import { precioUnit, totalCarrito, useCart } from "@/store/cart"

type Creada = { id: number; total_centavos: number }

export default function Cart() {
    const qc = useQueryClient()
    const { lineas, setCantidad, remove, clear } = useCart()
    const [cobrar, setCobrar] = useState<{ id: number; total: number } | null>(null)
    const total = totalCarrito(lineas)

    const crear = useMutation({
        mutationFn: (_cobrarYa: boolean) => {
            void _cobrarYa
            return api<Creada>("/orders", {
                method: "POST",
                json: {
                    items: lineas.map((l) => ({
                        producto_id: l.producto.id,
                        cantidad: l.cantidad,
                        opciones: l.opciones.map((o) => o.id),
                        nota: l.nota || undefined,
                    })),
                },
            })
        },
        onSuccess: (r, cobrarYa) => {
            clear()
            qc.invalidateQueries({ queryKey: ["orders"] })
            if (cobrarYa) setCobrar({ id: r.id, total: r.total_centavos })
            else toast.success(`Pedido #${r.id} creado`)
        },
        onError: (e) => toast.error(e.message),
    })

    return (
        <div className="flex h-full flex-col rounded-lg border">
            <h2 className="border-b p-3 text-lg font-semibold">Pedido actual</h2>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {lineas.length === 0 && (
                    <p className="py-8 text-center text-muted-foreground">Toca un producto para agregarlo</p>
                )}
                {lineas.map((l) => (
                    <div key={l.key} className="rounded-md border p-2">
                        <div className="flex justify-between gap-2">
                            <span className="font-medium">{l.producto.nombre}</span>
                            <span className="whitespace-nowrap">{pesos(precioUnit(l) * l.cantidad)}</span>
                        </div>
                        {l.opciones.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {l.opciones.map((o) => o.nombre).join(", ")}
                            </p>
                        )}
                        {l.nota && <p className="text-xs italic text-muted-foreground">“{l.nota}”</p>}
                        <div className="mt-2 flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10"
                                aria-label="Menos"
                                onClick={() => setCantidad(l.key, l.cantidad - 1)}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-semibold">{l.cantidad}</span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10"
                                aria-label="Más"
                                onClick={() => setCantidad(l.key, l.cantidad + 1)}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="ml-auto h-10 w-10 text-destructive"
                                aria-label="Quitar"
                                onClick={() => remove(l.key)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="space-y-2 border-t p-3">
                <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-3xl font-bold">{pesos(total)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant="outline"
                        className="h-14 text-base"
                        disabled={lineas.length === 0 || crear.isPending}
                        onClick={() => crear.mutate(false)}
                    >
                        Crear pedido
                    </Button>
                    <Button
                        className="h-14 text-base"
                        disabled={lineas.length === 0 || crear.isPending}
                        onClick={() => crear.mutate(true)}
                    >
                        Crear y cobrar
                    </Button>
                </div>
                {lineas.length > 0 && (
                    <Button variant="ghost" className="w-full" onClick={clear}>
                        Vaciar
                    </Button>
                )}
            </div>

            {cobrar && <PayDialog orden={cobrar} onClose={() => setCobrar(null)} />}
        </div>
    )
}
