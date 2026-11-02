import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  MapPin,
  PackageCheck,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import PayDialog from "@/components/PayDialog"
import { api } from "@/lib/api"
import { pesos } from "@/lib/format"
import { usePedidosActivos } from "@/lib/queries"
import type { Orden } from "@/lib/types"

function formatRelativo(iso: string, ahora: number): string {
  if (!iso) return ""
  const min = Math.max(0, Math.floor((ahora - Date.parse(iso)) / 60000))
  if (min === 0) return "Justo ahora"
  if (min === 1) return "Hace 1 min"
  if (min < 60) return `Hace ${min} min`
  return `Hace ${Math.floor(min / 60)} h`
}

const tipoLabel = (t: Orden["tipo"]) =>
  t === "domicilio" ? "Domicilio" : t === "llevar" ? "Para llevar" : "Comer aquí"

export default function PorCobrar() {
  const qc = useQueryClient()
  const { data, isLoading } = usePedidosActivos()
  const [cobrar, setCobrar] = useState<{ id: number; total: number } | null>(null)
  const [cancelarId, setCancelarId] = useState<number | null>(null)
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["orders"] })
    qc.invalidateQueries({ queryKey: ["stats"] })
  }

  const cancelar = useMutation({
    mutationFn: (id: number) => api(`/orders/${id}/cancelar`, { method: "PATCH" }),
    onSuccess: (_r, id) => {
      toast.success(`Pedido #${id} cancelado`)
      setCancelarId(null)
      setDetalleId(null)
      qc.setQueriesData<Orden[]>({ queryKey: ["orders"] }, (old) =>
        Array.isArray(old) ? old.filter((o) => o.id !== id) : old,
      )
      refrescar()
    },
    onError: (e) => toast.error(e.message),
  })

  const entregar = useMutation({
    mutationFn: (id: number) =>
      api(`/orders/${id}/cocina`, { method: "PATCH", json: { estado: "entregada" } }),
    onSuccess: (_r, id) => {
      toast.success(`Pedido #${id} entregado`)
      setDetalleId(null)
      qc.setQueriesData<Orden[]>({ queryKey: ["orders"] }, (old) =>
        Array.isArray(old) ? old.filter((o) => o.id !== id) : old,
      )
      refrescar()
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="grid gap-3 p-3 sm:p-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-2xl border border-border/50 bg-card/60 p-4"
          />
        ))}
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="flex h-full min-h-[50vh] animate-page-enter flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <PackageCheck className="size-8 stroke-[1.5]" />
        </div>
        <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
          Todos los pedidos están al día
        </h2>
        <p className="mt-1 max-w-sm text-xs sm:text-sm text-muted-foreground">
          No hay pedidos activos en este momento. Los nuevos aparecerán aquí automáticamente.
        </p>
      </div>
    )
  }

  const detalle = data.find((o) => o.id === detalleId) ?? null

  function renderAcciones(o: Orden, grande = false) {
    const pagado = o.estado_pago === "pagado"
    const alto = grande ? "h-11 sm:h-12 text-sm sm:text-base" : "h-10 text-xs sm:text-sm"
    if (pagado) {
      return (
        <Button
          className={`${alto} w-full gap-2 font-bold shadow-sm`}
          loading={entregar.isPending && entregar.variables === o.id}
          onClick={(e) => {
            e.stopPropagation()
            entregar.mutate(o.id)
          }}
        >
          <CheckCircle2 className="size-4 sm:size-4.5" />
          Entregado
        </Button>
      )
    }
    return (
      <div className="grid grid-cols-[1fr_auto] gap-1.5">
        <Button
          className={`${alto} gap-1.5 font-bold shadow-sm`}
          onClick={(e) => {
            e.stopPropagation()
            setDetalleId(null)
            setCobrar({ id: o.id, total: o.total_centavos })
          }}
        >
          <Banknote className="size-4 sm:size-4.5" />
          Cobrar
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-10 sm:size-10.5 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Cancelar pedido #${o.id}`}
          title="Cancelar pedido"
          onClick={(e) => {
            e.stopPropagation()
            setCancelarId(o.id)
          }}
        >
          <XCircle className="size-4 sm:size-4.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.map((o) => {
          const pagado = o.estado_pago === "pagado"
          const MAX_ITEMS = 3
          const itemsToShow = o.items.slice(0, MAX_ITEMS)
          const extraItems = o.items.length - MAX_ITEMS

          return (
            <div
              key={o.id}
              role="button"
              tabIndex={0}
              aria-label={`Ver detalle del pedido #${o.id}`}
              onClick={() => setDetalleId(o.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setDetalleId(o.id)
                }
              }}
              className="group animate-page-enter flex cursor-pointer flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all duration-150 hover:border-primary/50 hover:shadow-md hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]"
            >
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div>
                    <span className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                      Pedido #{o.id}
                    </span>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3" />
                      <span>{formatRelativo(o.creada_en, ahora)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={pagado ? "secondary" : "destructive"} className="text-[10px] px-2 py-0.5">
                      {pagado ? "Pagado" : "Por cobrar"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium">
                      {tipoLabel(o.tipo)}
                    </Badge>
                  </div>
                </div>

                <div className="py-2.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {pagado ? "Total pagado" : "Total a cobrar"}
                  </span>
                  <p className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                    {pesos(o.total_centavos)}
                  </p>
                </div>

                <ul className="space-y-1.5 border-t border-border/40 pt-2 text-xs">
                  {itemsToShow.map((it, i) => (
                    <li key={i} className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-primary tabular-nums">{it.cantidad}×</span>
                        <span className="font-medium text-foreground">{it.nombre}</span>
                      </div>
                      {it.opciones.length > 0 && (
                        <p className="line-clamp-1 pl-3.5 text-[11px] text-muted-foreground">
                          {it.opciones.map((x) => x.nombre).join(" · ")}
                        </p>
                      )}
                      {it.nota && (
                        <p className="pl-3.5 text-[11px] font-medium italic text-primary">“{it.nota}”</p>
                      )}
                    </li>
                  ))}
                  {extraItems > 0 && (
                    <li className="text-[11px] font-medium text-muted-foreground pt-0.5">
                      +{extraItems} más...
                    </li>
                  )}
                </ul>
              </div>

              <div className="mt-4 border-t border-border/50 pt-2.5">{renderAcciones(o)}</div>
            </div>
          )
        })}
      </div>

      {/* Detalle ampliado del pedido */}
      {detalle && (
        <Dialog open onOpenChange={(open) => !open && setDetalleId(null)}>
          <DialogContent className="max-h-[90dvh] max-w-lg gap-0 overflow-y-auto p-0">
            <DialogHeader className="border-b p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <DialogTitle className="font-heading text-2xl sm:text-3xl font-bold">
                    Pedido #{detalle.id}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 flex items-center gap-1.5 text-xs sm:text-sm">
                    <Clock className="size-3.5" />
                    {formatRelativo(detalle.creada_en, ahora)}
                  </DialogDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant={detalle.estado_pago === "pagado" ? "secondary" : "destructive"}
                    className="px-2.5 py-0.5 text-xs"
                  >
                    {detalle.estado_pago === "pagado" ? "Pagado · falta entregar" : "Por cobrar"}
                  </Badge>
                  <Badge variant="outline" className="px-2.5 py-0.5 text-xs">
                    {tipoLabel(detalle.tipo)}
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="rounded-2xl bg-primary/10 p-3 sm:p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {detalle.estado_pago === "pagado" ? "Total pagado" : "Total a cobrar"}
                </p>
                <p className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums mt-0.5">
                  {pesos(detalle.total_centavos)}
                </p>
              </div>

              <ul className="space-y-3">
                {detalle.items.map((it, i) => (
                  <li key={i} className="rounded-xl border p-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg sm:text-xl font-bold text-primary tabular-nums">
                        {it.cantidad}×
                      </span>
                      <span className="text-base sm:text-lg font-semibold leading-tight">{it.nombre}</span>
                    </div>
                    {it.opciones.length > 0 && (
                      <ul className="mt-1.5 flex flex-wrap gap-1">
                        {it.opciones.map((x, j) => (
                          <li
                            key={j}
                            className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground"
                          >
                            {x.nombre}
                          </li>
                        ))}
                      </ul>
                    )}
                    {it.nota && (
                      <p className="mt-1.5 flex items-start gap-1 text-xs sm:text-sm font-medium text-primary">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        {it.nota}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              {detalle.nota && (
                <p className="rounded-xl border bg-muted/40 p-3 text-xs sm:text-sm">
                  <span className="font-semibold">Nota general: </span>
                  {detalle.nota}
                </p>
              )}

              {detalle.tipo === "domicilio" && detalle.direccion && (
                <p className="flex items-start gap-2 rounded-xl border p-3 text-xs sm:text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    {detalle.cliente_nombre && <strong>{detalle.cliente_nombre} · </strong>}
                    {detalle.direccion}
                  </span>
                </p>
              )}
            </div>

            <div className="border-t p-4 sm:p-5">{renderAcciones(detalle, true)}</div>
          </DialogContent>
        </Dialog>
      )}

      {cobrar && <PayDialog orden={cobrar} onClose={() => setCobrar(null)} />}

      {cancelarId !== null && (
        <Dialog open onOpenChange={(open) => !open && setCancelarId(null)}>
          <DialogContent className="max-w-md p-4 sm:p-6">
            <div className="flex flex-col items-center p-1 text-center">
              <div className="mb-2.5 flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <AlertTriangle className="size-6" />
              </div>
              <DialogHeader className="gap-1">
                <DialogTitle className="text-center font-heading text-lg sm:text-xl font-bold">
                  ¿Cancelar el Pedido #{cancelarId}?
                </DialogTitle>
                <DialogDescription className="text-center text-xs sm:text-sm text-muted-foreground">
                  Esta acción anulará el pedido y no se podrá recuperar. ¿Estás seguro de continuar?
                </DialogDescription>
              </DialogHeader>
            </div>
            <DialogFooter className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="h-10 sm:h-11 font-medium text-xs sm:text-sm"
                onClick={() => setCancelarId(null)}
              >
                Volver
              </Button>
              <Button
                variant="destructive"
                className="h-10 sm:h-11 font-bold text-xs sm:text-sm"
                loading={cancelar.isPending}
                onClick={() => cancelar.mutate(cancelarId)}
              >
                Sí, cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
