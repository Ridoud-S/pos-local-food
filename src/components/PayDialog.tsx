import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { pesos } from "@/lib/format"
import { cn } from "@/lib/utils"

type Metodo = "efectivo" | "transferencia" | "tarjeta"
type Resp = { cambio_centavos: number }
type Props = { orden: { id: number; total: number }; onClose: () => void }

const BILLETES = [50, 100, 200, 500]
const METODOS: { id: Metodo; label: string }[] = [
    { id: "efectivo", label: "Efectivo" },
    { id: "transferencia", label: "Transferencia" },
    { id: "tarjeta", label: "Tarjeta" },
]

export default function PayDialog({ orden, onClose }: Props) {
    const qc = useQueryClient()
    const [metodo, setMetodo] = useState<Metodo>("efectivo")
    const [recibido, setRecibido] = useState("")
    const [cambioFinal, setCambioFinal] = useState<number | null>(null)

    const recibidoC = Math.round((parseFloat(recibido.replace(",", ".")) || 0) * 100)
    const cambio = recibidoC - orden.total
    const alcanza = metodo !== "efectivo" || recibidoC >= orden.total

    const pagar = useMutation({
        mutationFn: () =>
            api<Resp>(`/orders/${orden.id}/pagar`, {
                method: "PATCH",
                json:
                    metodo === "efectivo"
                        ? { metodo_pago: metodo, monto_recibido_centavos: recibidoC }
                        : { metodo_pago: metodo },
            }),
        onSuccess: (r) => {
            setCambioFinal(r.cambio_centavos)
            qc.invalidateQueries({ queryKey: ["orders"] })
        },
        onError: (e) => toast.error(e.message),
    })

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                {cambioFinal !== null ? (
                    <div className="space-y-6 py-4 text-center">
                        <DialogHeader>
                            <DialogTitle className="text-center text-xl">Pedido #{orden.id} pagado</DialogTitle>
                            <DialogDescription className="text-center">Cambio a entregar</DialogDescription>
                        </DialogHeader>
                        <p className="text-6xl font-bold text-green-600">{pesos(cambioFinal)}</p>
                        <Button className="h-14 w-full text-base" onClick={onClose}>
                            Listo
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <DialogHeader>
                            <DialogTitle>Cobrar pedido #{orden.id}</DialogTitle>
                            <DialogDescription>Total a cobrar</DialogDescription>
                        </DialogHeader>
                        <p className="text-center text-5xl font-bold">{pesos(orden.total)}</p>

                        <div className="grid grid-cols-3 gap-2">
                            {METODOS.map((m) => (
                                <Button
                                    key={m.id}
                                    variant={metodo === m.id ? "default" : "outline"}
                                    className="h-12"
                                    onClick={() => setMetodo(m.id)}
                                >
                                    {m.label}
                                </Button>
                            ))}
                        </div>

                        {metodo === "efectivo" && (
                            <div className="space-y-3">
                                <Input
                                    className="h-14 text-center text-2xl"
                                    inputMode="decimal"
                                    placeholder="Monto recibido"
                                    value={recibido}
                                    onChange={(e) => setRecibido(e.target.value)}
                                />
                                <div className="grid grid-cols-5 gap-2">
                                    <Button
                                        variant="outline"
                                        className="h-12"
                                        onClick={() => setRecibido(String(orden.total / 100))}
                                    >
                                        Exacto
                                    </Button>
                                    {BILLETES.map((b) => (
                                        <Button
                                            key={b}
                                            variant="outline"
                                            className="h-12"
                                            onClick={() => setRecibido(String(b))}
                                        >
                                            ${b}
                                        </Button>
                                    ))}
                                </div>
                                {recibidoC > 0 && (
                                    <p
                                        className={cn(
                                            "text-center text-3xl font-bold",
                                            cambio >= 0 ? "text-green-600" : "text-destructive",
                                        )}
                                    >
                                        {cambio >= 0 ? `Cambio ${pesos(cambio)}` : `Faltan ${pesos(-cambio)}`}
                                    </p>
                                )}
                            </div>
                        )}

                        <Button
                            className="h-14 w-full text-base"
                            disabled={!alcanza || pagar.isPending}
                            onClick={() => pagar.mutate()}
                        >
                            {pagar.isPending ? "Cobrando..." : "Confirmar pago"}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}