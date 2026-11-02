import { useState } from "react"
import { Check, Minus, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
      producto.grupos.map((g) => [
        g.id,
        g.opciones.filter((o) => o.es_default).map((o) => o.id),
      ]),
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
    producto.precio_centavos +
    elegidas.reduce((a, o) => a + o.precio_extra_centavos, 0)

  function agregar() {
    add({ producto, cantidad, opciones: elegidas, nota: nota.trim() })
    onClose()
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {/* Header */}
        <SheetHeader className="border-b border-border/70 p-5 bg-muted/20">
          <SheetTitle className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {producto.nombre}
          </SheetTitle>
          <SheetDescription className="font-heading font-bold text-lg text-primary tabular-nums">
            {pesos(producto.precio_centavos)} base
          </SheetDescription>
        </SheetHeader>

        {/* Options Selection Body */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          {producto.grupos.map((g) => {
            const n = (sel[g.id] ?? []).length
            const isFaltante = n < g.min

            return (
              <section key={g.id} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-sm tracking-tight">
                    {g.nombre}
                  </h3>
                  <Badge
                    variant={isFaltante ? "destructive" : "secondary"}
                    className="text-[11px] font-semibold"
                  >
                    {isFaltante
                      ? `Requerido (mín. ${g.min})`
                      : g.max === 1
                      ? "Elige 1"
                      : `${n} de ${g.max}`}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {g.opciones.map((o) => {
                    const activa = (sel[g.id] ?? []).includes(o.id)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggle(g, o)}
                        className={cn(
                          "relative flex min-h-16 flex-col justify-center rounded-2xl border p-3 text-left transition-all duration-150 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          activa
                            ? "border-primary bg-primary/15 text-foreground shadow-xs shadow-primary/10"
                            : "border-border/80 bg-card hover:bg-muted/60 text-foreground"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-sm leading-tight">
                            {o.nombre}
                          </span>
                          {activa && (
                            <div className="animate-check flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        {o.precio_extra_centavos > 0 && (
                          <span className="mt-1 font-heading text-xs font-bold text-primary tabular-nums">
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

          {/* Special Instructions Note */}
          <section className="space-y-2 pt-2">
            <h3 className="font-semibold text-foreground text-sm tracking-tight">
              Nota especial o instrucciones
            </h3>
            <Input
              className="h-12 bg-card/70"
              placeholder="Ej. sin cebolla, salsa aparte..."
              maxLength={200}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </section>
        </div>

        {/* Footer with Quantity & Add Button */}
        <SheetFooter className="gap-3 border-t border-border/80 bg-muted/20 p-5">
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="size-12 rounded-xl"
              aria-label="Disminuir cantidad"
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
            >
              <Minus className="size-5" />
            </Button>
            <span className="w-12 text-center font-heading text-2xl font-bold tabular-nums">
              {cantidad}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-12 rounded-xl"
              aria-label="Aumentar cantidad"
              onClick={() => setCantidad((c) => Math.min(50, c + 1))}
            >
              <Plus className="size-5" />
            </Button>
          </div>

          <Button
            size="lg"
            className="h-14 w-full text-base font-bold shadow-md shadow-primary/20"
            disabled={!valido}
            onClick={agregar}
          >
            Agregar al pedido · {pesos(unitario * cantidad)}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
