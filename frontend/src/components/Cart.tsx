import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import PayDialog from "@/components/PayDialog"
import { api } from "@/lib/api"
import { pesos } from "@/lib/format"
import { precioUnit, totalCarrito, useCart, type Linea } from "@/store/cart"

type Creada = { id: number; total_centavos: number }

type ItemsListProps = {
  lineas: Linea[]
  onSetCantidad: (key: string, n: number) => void
  onRemove: (key: string) => void
}

function CartItemsList({ lineas, onSetCantidad, onRemove }: ItemsListProps) {
  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
      {lineas.length === 0 ? (
        <div className="flex h-full min-h-40 flex-col items-center justify-center text-center p-4 text-muted-foreground">
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground/60">
            <ShoppingBag className="size-6 stroke-[1.5]" />
          </div>
          <p className="font-medium text-foreground text-sm">El pedido está vacío</p>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-[180px]">
            Toca cualquier producto del menú para comenzar
          </p>
        </div>
      ) : (
        lineas.map((l) => (
          <div
            key={l.key}
            className="animate-page-enter rounded-xl border border-border/70 bg-card/60 p-3 transition-all hover:border-primary/40 shadow-2xs"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-foreground text-xs sm:text-sm leading-snug">
                {l.producto.nombre}
              </span>
              <span className="font-heading font-bold text-foreground tabular-nums whitespace-nowrap text-sm sm:text-base">
                {pesos(precioUnit(l) * l.cantidad)}
              </span>
            </div>

            {l.opciones.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {l.opciones.map((o) => o.nombre).join(" · ")}
              </p>
            )}

            {l.nota && (
              <p className="mt-0.5 text-xs italic text-primary font-medium">
                “{l.nota}”
              </p>
            )}

            {/* Quantity Controls */}
            <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-border/40">
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 border border-border/50">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7.5 rounded-md"
                  aria-label={`Reducir cantidad de ${l.producto.nombre}`}
                  onClick={() => onSetCantidad(l.key, l.cantidad - 1)}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="w-6 text-center font-bold text-xs sm:text-sm tabular-nums">
                  {l.cantidad}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7.5 rounded-md"
                  aria-label={`Aumentar cantidad de ${l.producto.nombre}`}
                  onClick={() => onSetCantidad(l.key, l.cantidad + 1)}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="size-7.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label={`Quitar ${l.producto.nombre} del pedido`}
                onClick={() => onRemove(l.key)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

type FooterProps = {
  hasItems: boolean
  total: number
  isPending: boolean
  isPendingCrearYa: boolean
  onCrear: (cobrarYa: boolean) => void
  onClear: () => void
}

function CartFooter({
  hasItems,
  total,
  isPending,
  isPendingCrearYa,
  onCrear,
  onClear,
}: FooterProps) {
  return (
    <div className="space-y-2.5 border-t border-border/80 bg-muted/20 p-3 sm:p-4">
      <div className="flex items-baseline justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Total a pagar
        </span>
        <span
          key={total}
          className="animate-pulse-subtle font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums"
        >
          {pesos(total)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="lg"
          className="h-11 sm:h-12 text-xs sm:text-sm font-semibold"
          loading={isPending && !isPendingCrearYa}
          disabled={!hasItems || isPending}
          onClick={() => onCrear(false)}
        >
          Crear pedido
        </Button>

        <Button
          variant="default"
          size="lg"
          className="h-11 sm:h-12 text-xs sm:text-sm font-bold"
          loading={isPending && isPendingCrearYa}
          disabled={!hasItems || isPending}
          onClick={() => onCrear(true)}
        >
          Crear y cobrar
        </Button>
      </div>

      {hasItems && (
        <Button
          variant="ghost"
          className="h-7 w-full text-[11px] text-muted-foreground hover:text-destructive hover:bg-transparent"
          onClick={onClear}
        >
          Vaciar pedido
        </Button>
      )}
    </div>
  )
}

export default function Cart() {
  const qc = useQueryClient()
  const { lineas, setCantidad, remove, clear } = useCart()
  const [cobrar, setCobrar] = useState<{ id: number; total: number } | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const total = totalCarrito(lineas)
  const totalArticulos = lineas.reduce((acc, l) => acc + l.cantidad, 0)

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
      setMobileOpen(false)
      if (cobrarYa) {
        setCobrar({ id: r.id, total: r.total_centavos })
      } else {
        qc.invalidateQueries({ queryKey: ["orders"] })
        toast.success(`Pedido #${r.id} creado`)
      }
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <>
      {/* Desktop sidebar cart (visible on lg+) */}
      <div className="hidden lg:flex h-full flex-col rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-4.5 text-primary" />
            <h2 className="font-heading text-base font-bold tracking-tight text-foreground">
              Pedido actual
            </h2>
          </div>
          {lineas.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary tabular-nums">
              {totalArticulos} {totalArticulos === 1 ? "artículo" : "artículos"}
            </span>
          )}
        </div>

        <CartItemsList
          lineas={lineas}
          onSetCantidad={setCantidad}
          onRemove={remove}
        />
        <CartFooter
          hasItems={lineas.length > 0}
          total={total}
          isPending={crear.isPending}
          isPendingCrearYa={!!crear.variables}
          onCrear={(cobrarYa) => crear.mutate(cobrarYa)}
          onClear={clear}
        />
      </div>

      {/* Mobile Floating Sticky Bar (visible on < lg when cart has items) */}
      {lineas.length > 0 && (
        <div className="fixed bottom-[calc(4.2rem+env(safe-area-inset-bottom))] inset-x-3 z-30 lg:hidden animate-page-enter">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-12 w-full items-center justify-between rounded-2xl bg-primary px-4 font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/20 text-primary-foreground text-xs">
                {totalArticulos}
              </div>
              <span className="text-sm font-semibold">Ver pedido</span>
            </div>
            <span className="font-heading text-base font-extrabold tabular-nums">
              {pesos(total)}
            </span>
          </button>
        </div>
      )}

      {/* Mobile Bottom Sheet Cart Modal */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] rounded-t-3xl p-0 flex flex-col gap-0 border-t border-border/80"
          showCloseButton={false}
        >
          <SheetHeader className="flex flex-row items-center justify-between border-b border-border/70 p-4 bg-muted/20">
            <div className="flex items-center gap-2">
              <ShoppingBag className="size-4.5 text-primary" />
              <SheetTitle className="font-heading text-base font-bold tracking-tight text-foreground">
                Pedido actual ({totalArticulos})
              </SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Cerrar pedido"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </SheetHeader>

          <CartItemsList
            lineas={lineas}
            onSetCantidad={setCantidad}
            onRemove={remove}
          />
          <CartFooter
            hasItems={lineas.length > 0}
            total={total}
            isPending={crear.isPending}
            isPendingCrearYa={!!crear.variables}
            onCrear={(cobrarYa) => crear.mutate(cobrarYa)}
            onClear={clear}
          />
        </SheetContent>
      </Sheet>

      {/* PayDialog modal */}
      {cobrar && <PayDialog orden={cobrar} onClose={() => setCobrar(null)} />}
    </>
  )
}
