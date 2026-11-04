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

const NOTAS_RAPIDAS = [
  "Sin cebolla",
  "Sin verdura",
  "Sin salsa",
  "Salsa aparte",
  "Bien dorado",
] as const

function parseNotas(texto: string): string[] {
  return texto
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function isChipActivo(chip: string, texto: string): boolean {
  const partes = parseNotas(texto)
  return partes.some((p) => p.toLowerCase() === chip.toLowerCase())
}

function toggleChip(chip: string, texto: string): string {
  const partes = parseNotas(texto)
  const idx = partes.findIndex((p) => p.toLowerCase() === chip.toLowerCase())
  if (idx !== -1) {
    partes.splice(idx, 1)
  } else {
    partes.push(chip)
  }
  return partes.join(", ")
}

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
      <SheetContent
        side="bottom"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md sm:side-right max-h-[88dvh] rounded-t-3xl sm:rounded-none sm:h-full sm:max-h-full border-t sm:border-l sm:border-t-0"
      >
        {/* Header */}
        <SheetHeader className="border-b border-border/70 p-4 sm:p-5 bg-muted/20">
          <SheetTitle className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {producto.nombre}
          </SheetTitle>
          <SheetDescription className="font-heading font-bold text-base sm:text-lg text-primary tabular-nums">
            {pesos(producto.precio_centavos)} base
          </SheetDescription>
        </SheetHeader>

        {/* Options Selection Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          {producto.grupos.map((g) => {
            const n = (sel[g.id] ?? []).length
            const isFaltante = n < g.min

            return (
              <section key={g.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-xs sm:text-sm tracking-tight">
                    {g.nombre}
                  </h3>
                  <Badge
                    variant={isFaltante ? "destructive" : "secondary"}
                    className="text-[10px] sm:text-[11px] font-semibold"
                  >
                    {isFaltante
                      ? `Requerido (mín. ${g.min})`
                      : g.max === 1
                      ? "Elige 1"
                      : `${n} de ${g.max}`}
                  </Badge>
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
                          "relative flex min-h-14 sm:min-h-16 flex-col justify-center rounded-xl border p-2.5 sm:p-3 text-left transition-all duration-150 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          activa
                            ? "border-primary bg-primary/15 text-foreground shadow-2xs shadow-primary/10"
                            : "border-border/80 bg-card hover:bg-muted/60 text-foreground"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs sm:text-sm leading-tight">
                            {o.nombre}
                          </span>
                          {activa && (
                            <div className="animate-check flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        {o.precio_extra_centavos > 0 && (
                          <span className="mt-0.5 font-heading text-[11px] sm:text-xs font-bold text-primary tabular-nums">
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
          <section className="space-y-1.5 pt-1">
            <h3 className="font-semibold text-foreground text-xs sm:text-sm tracking-tight">
              Nota especial o instrucciones
            </h3>
            <Input
              className="h-11 sm:h-12 bg-card/70 text-base"
              placeholder="Ej. sin cebolla, salsa aparte..."
              maxLength={200}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
            {/* Chips de notas rápidas */}
            <div className="flex flex-wrap gap-2 pt-1">
              {NOTAS_RAPIDAS.map((chip) => {
                const activo = isChipActivo(chip, nota)
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setNota(toggleChip(chip, nota))}
                    className={cn(
                      "flex min-h-[44px] items-center justify-center rounded-xl border px-3.5 text-xs sm:text-sm font-semibold transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      activo
                        ? "border-primary bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                        : "border-border/80 bg-card text-foreground hover:bg-muted/70 hover:border-primary/40"
                    )}
                  >
                    {chip}
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        {/* Footer with Quantity & Add Button */}
        <SheetFooter className="gap-2.5 border-t border-border/80 bg-muted/20 p-4 sm:p-5">
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="size-10 sm:size-11 rounded-xl"
              aria-label="Disminuir cantidad"
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-10 text-center font-heading text-xl font-bold tabular-nums">
              {cantidad}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-10 sm:size-11 rounded-xl"
              aria-label="Aumentar cantidad"
              onClick={() => setCantidad((c) => Math.min(50, c + 1))}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <Button
            size="lg"
            className="h-11 sm:h-12 w-full text-xs sm:text-sm font-bold shadow-md shadow-primary/20"
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
