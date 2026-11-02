import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react"
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
      else toast.success(`Pedido #${r.id} creado con éxito`)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="flex h-full flex-col rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <ShoppingBag className="size-5 text-primary" />
          <h2 className="font-heading text-lg font-bold tracking-tight text-foreground">
            Pedido actual
          </h2>
        </div>
        {lineas.length > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary tabular-nums">
            {lineas.reduce((acc, l) => acc + l.cantidad, 0)} {lineas.length === 1 && lineas[0].cantidad === 1 ? "artículo" : "artículos"}
          </span>
        )}
      </div>

      {/* Cart Lines Scroll Area */}
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
        {lineas.length === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground/60">
              <ShoppingBag className="size-7 stroke-[1.5]" />
            </div>
            <p className="font-medium text-foreground text-base">El pedido está vacío</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              Toca cualquier producto del menú para comenzar
            </p>
          </div>
        ) : (
          lineas.map((l) => (
            <div
              key={l.key}
              className="animate-page-enter rounded-2xl border border-border/70 bg-card/60 p-3.5 transition-all hover:border-primary/40 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-foreground text-sm leading-snug">
                  {l.producto.nombre}
                </span>
                <span className="font-heading font-bold text-foreground tabular-nums whitespace-nowrap text-base">
                  {pesos(precioUnit(l) * l.cantidad)}
                </span>
              </div>

              {l.opciones.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {l.opciones.map((o) => o.nombre).join(" · ")}
                </p>
              )}

              {l.nota && (
                <p className="mt-1 text-xs italic text-primary font-medium">
                  “{l.nota}”
                </p>
              )}

              {/* Quantity Controls */}
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40">
                <div className="flex items-center gap-1.5 bg-muted/50 rounded-xl p-0.5 border border-border/50">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-lg"
                    aria-label={`Reducir cantidad de ${l.producto.nombre}`}
                    onClick={() => setCantidad(l.key, l.cantidad - 1)}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-8 text-center font-bold text-sm tabular-nums">
                    {l.cantidad}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-lg"
                    aria-label={`Aumentar cantidad de ${l.producto.nombre}`}
                    onClick={() => setCantidad(l.key, l.cantidad + 1)}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Quitar ${l.producto.nombre} del pedido`}
                  onClick={() => remove(l.key)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Footer */}
      <div className="space-y-3 border-t border-border/80 bg-muted/20 p-4">
        <div className="flex items-baseline justify-between px-1">
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Total a pagar
          </span>
          <span
            key={total}
            className="animate-pulse-subtle font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums"
          >
            {pesos(total)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="outline"
            size="lg"
            className="h-14 text-sm font-semibold"
            loading={crear.isPending && !crear.variables}
            disabled={lineas.length === 0 || crear.isPending}
            onClick={() => crear.mutate(false)}
          >
            Crear pedido
          </Button>

          <Button
            variant="default"
            size="lg"
            className="h-14 text-sm font-bold"
            loading={crear.isPending && !!crear.variables}
            disabled={lineas.length === 0 || crear.isPending}
            onClick={() => crear.mutate(true)}
          >
            Crear y cobrar
          </Button>
        </div>

        {lineas.length > 0 && (
          <Button
            variant="ghost"
            className="h-9 w-full text-xs text-muted-foreground hover:text-destructive hover:bg-transparent"
            onClick={clear}
          >
            Vaciar pedido
          </Button>
        )}
      </div>

      {cobrar && <PayDialog orden={cobrar} onClose={() => setCobrar(null)} />}
    </div>
  )
}
