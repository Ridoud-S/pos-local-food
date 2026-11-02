import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { pesos } from "@/lib/format"
import type { Grupo, Opcion, Producto } from "@/lib/types"
import { useCart } from "@/store/cart"
import { cn } from "@/lib/utils"

type Props = { producto: Producto; onClose: () => void }

export default function ProductSheet({ producto, onClose }: Props) {
    const add = useCart((s) => s.add)
    const [sel, setSel] = useState<Record<number, number[]>>(() =>
        Object.fromEntries(
            producto.grupos.map((g) => [g.id, g.opciones.filter((o) => o.es_default).map((o) => o.id)]),
        ),
    )
    const [cantidad, setCantidad] = useState(1)
    const [nota, setNota] = useState("")

    function toggle(g: Grupo, o: Opcion) {
        setSel((prev) => {
            const cur = prev[g.id] ?? []
            if (cur.includes(o.id)) return { ...prev, [g.id]: cur.filter((x) => x !== o.id) }
            if (g.max === 1) return { ...prev, [g.id]: [o.id] }
            if (cur.length >= g.max) return prev
            return { ...prev, [g.id]: [...cur, o.id] }
        })
    }

    const valido = producto.grupos.every((g) => {
        const n = (sel[g.id] ?? []).length
        return n >= g.min && n <= g.max
    })

    const elegidas = producto.grupos.flatMap((g) =>
        g.opciones.filter((o) => (sel[g.id] ?? []).includes(o.id)),
    )
    const unitario =
        producto.precio_centavos + elegidas.reduce((a, o) => a + o.precio_extra_centavos, 0)

    function agregar() {
        add({ producto, cantidad, opciones: elegidas, nota: nota.trim() })
        onClose()
    }

    return (
        <Sheet open onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
                <SheetHeader className="border-b p-4">
                    <SheetTitle className="text-xl">{producto.nombre}</SheetTitle>
                    <SheetDescription>{pesos(producto.precio_centavos)}</SheetDescription>
                </SheetHeader>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
                    {producto.grupos.map((g) => {
                        const n = (sel[g.id] ?? []).length
                        return (
                            <section key={g.id}>
                                <div className="mb-2 flex items-baseline justify-between">
                                    <h3 className="font-semibold">{g.nombre}</h3>
                                    <span
                                        className={cn(
                                            "text-xs",
                                            n < g.min ? "font-medium text-destructive" : "text-muted-foreground",
                                        )}
                                    >
                                        {g.min > 0 ? "Obligatorio" : g.max === 1 ? "Elige 1" : `Hasta ${g.max}`}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {g.opciones.map((o) => {
                                        const activa = (sel[g.id] ?? []).includes(o.id)
                                        return (
                                            <button
                                                key={o.id}
                                                type="button"
                                                onClick={() => toggle(g, o)}
                                                className={cn(
                                                    "flex min-h-14 flex-col items-start justify-center rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                                                    activa
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : "hover:bg-muted",
                                                )}
                                            >
                                                <span className="font-medium">{o.nombre}</span>
                                                {o.precio_extra_centavos > 0 && (
                                                    <span className="text-xs opacity-80">
                                                        +{pesos(o.precio_extra_centavos)}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </section>
                        )
                    })}

                    <section>
                        <h3 className="mb-2 font-semibold">Nota</h3>
                        <Input
                            className="h-12"
                            placeholder="Ej. sin picante"
                            maxLength={200}
                            value={nota}
                            onChange={(e) => setNota(e.target.value)}
                        />
                    </section>
                </div>

                <SheetFooter className="gap-3 border-t p-4">
                    <div className="flex items-center justify-center gap-4">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12"
                            aria-label="Menos"
                            onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                        >
                            <Minus className="h-5 w-5" />
                        </Button>
                        <span className="w-10 text-center text-2xl font-semibold">{cantidad}</span>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12"
                            aria-label="Más"
                            onClick={() => setCantidad((c) => Math.min(50, c + 1))}
                        >
                            <Plus className="h-5 w-5" />
                        </Button>
                    </div>
                    <Button className="h-14 text-base" disabled={!valido} onClick={agregar}>
                        Agregar · {pesos(unitario * cantidad)}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}