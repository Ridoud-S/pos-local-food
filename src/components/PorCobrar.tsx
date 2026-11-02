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
      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-3xl border border-border/50 bg-card/60 p-5"
          />
        ))}
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="flex h-full min-h-[50vh] animate-page-enter flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <PackageCheck className="size-10 stroke-[1.5]" />
        </div>
        <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Todos los pedidos están al día
        </h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          No hay pedidos activos en este momento. Los nuevos aparecerán aquí automáticamente.
        </p>
      </div>
    )
  }

  const detalle = data.find((o) => o.id === detalleId) ?? null

  // Botones de acción según el estado; se llama como función (no es un componente)
  function renderAcciones(o: Orden, grande = false) {
    const pagado = o.estado_pago === "pagado"
    const alto = grande ? "h-14 text-base" : "h-13 text-sm"
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
          <CheckCircle2 className="size-5" />
          Entregado
        </Button>
      )
    }
    return (
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button
          className={`${alto} gap-2 font-bold shadow-sm`}
          onClick={(e) => {
            e.stopPropagation()
            setDetalleId(null)
            setCobrar({ id: o.id, total: o.total_centavos })
          }}
        >
          <Banknote className="size-5" />
          Cobrar
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-13 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Cancelar pedido #${o.id}`}
          title="Cancelar pedido"
          onClick={(e) => {
            e.stopPropagation()
            setCancelarId(o.id)
          }}
        >
          <XCircle className="size-5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.map((o) => {
          const pagado = o.estado_pago === "pagado"
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
              className="group animate-page-enter flex cursor-pointer flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-150 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]"
            >
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-3">
                  <div>
                    <span className="font-heading text-2xl font-bold tracking-tight text-foreground">
                      Pedido #{o.id}
                    </span>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3.5" />
                      <span>{formatRelativo(o.creada_en, ahora)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={pagado ? "secondary" : "destructive"} className="text-xs">
                      {pagado ? "Pagado" : "Por cobrar"}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-medium">
                      {tipoLabel(o.tipo)}
                    </Badge>
                  </div>
                </div>

                <div className="py-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {pagado ? "Total pagado" : "Total a cobrar"}
                  </span>
                  <p className="font-heading text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                    {pesos(o.total_centavos)}
                  </p>
                </div>

                <ul className="space-y-2 border-t border-border/40 pt-3 text-sm">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-primary tabular-nums">{it.cantidad}×</span>
                        <span className="font-medium text-foreground">{it.nombre}</span>
                      </div>
                      {it.opciones.length > 0 && (
                        <p className="line-clamp-2 pl-4 text-xs text-muted-foreground">
                          {it.opciones.map((x) => x.nombre).join(" · ")}
                        </p>
                      )}
                      {it.nota && (
                        <p className="pl-4 text-xs font-medium italic text-primary">“{it.nota}”</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 border-t border-border/50 pt-3">{renderAcciones(o)}</div>
            </div>
          )
        })}
      </div>

      {/* Detalle ampliado del pedido */}
      {detalle && (
        <Dialog open onOpenChange={(open) => !open && setDetalleId(null)}>
          <DialogContent className="max-h-[92vh] max-w-lg gap-0 overflow-y-auto p-0">
            <DialogHeader className="border-b p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="font-heading text-3xl font-bold">
                    Pedido #{detalle.id}
                  </DialogTitle>
                  <DialogDescription className="mt-1 flex items-center gap-1.5 text-base">
                    <Clock className="size-4" />
                    {formatRelativo(detalle.creada_en, ahora)}
                  </DialogDescription>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge
                    variant={detalle.estado_pago === "pagado" ? "secondary" : "destructive"}
                    className="px-3 py-1 text-sm"
                  >
                    {detalle.estado_pago === "pagado" ? "Pagado · falta entregar" : "Por cobrar"}
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1 text-sm">
                    {tipoLabel(detalle.tipo)}
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 p-5">
              <div className="rounded-2xl bg-primary/10 p-4 text-center">
                <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  {detalle.estado_pago === "pagado" ? "Total pagado" : "Total a cobrar"}
                </p>
                <p className="font-heading text-5xl font-extrabold tracking-tight tabular-nums">
                  {pesos(detalle.total_centavos)}
                </p>
              </div>

              <ul className="space-y-4">
                {detalle.items.map((it, i) => (
                  <li key={i} className="rounded-2xl border p-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary tabular-nums">
                        {it.cantidad}×
                      </span>
                      <span className="text-xl font-semibold leading-tight">{it.nombre}</span>
                    </div>
                    {it.opciones.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {it.opciones.map((x, j) => (
                          <li
                            key={j}
                            className="rounded-full bg-muted px-3 py-1 text-base text-foreground"
                          >
                            {x.nombre}
                          </li>
                        ))}
                      </ul>
                    )}
                    {it.nota && (
                      <p className="mt-2 flex items-start gap-1.5 text-lg font-medium text-primary">
                        <AlertTriangle className="mt-1 size-4 shrink-0" />
                        {it.nota}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              {detalle.nota && (
                <p className="rounded-2xl border bg-muted/40 p-4 text-lg">
                  <span className="font-semibold">Nota general: </span>
                  {detalle.nota}
                </p>
              )}

              {detalle.tipo === "domicilio" && detalle.direccion && (
                <p className="flex items-start gap-2 rounded-2xl border p-4 text-lg">
                  <MapPin className="mt-1 size-5 shrink-0 text-primary" />
                  <span>
                    {detalle.cliente_nombre && <strong>{detalle.cliente_nombre} · </strong>}
                    {detalle.direccion}
                  </span>
                </p>
              )}
            </div>

            <div className="border-t p-5">{renderAcciones(detalle, true)}</div>
          </DialogContent>
        </Dialog>
      )}

      {cobrar && <PayDialog orden={cobrar} onClose={() => setCobrar(null)} />}

      {cancelarId !== null && (
        <Dialog open onOpenChange={(open) => !open && setCancelarId(null)}>
          <DialogContent className="max-w-md">
            <div className="flex flex-col items-center p-2 text-center">
              <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <AlertTriangle className="size-7" />
              </div>
              <DialogHeader className="gap-1">
                <DialogTitle className="text-center font-heading text-xl font-bold">
                  ¿Cancelar el Pedido #{cancelarId}?
                </DialogTitle>
                <DialogDescription className="text-center text-sm text-muted-foreground">
                  Esta acción anulará el pedido y no se podrá recuperar. ¿Estás seguro de continuar?
                </DialogDescription>
              </DialogHeader>
            </div>
            <DialogFooter className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="h-12 font-medium"
                onClick={() => setCancelarId(null)}
              >
                Volver
              </Button>
              <Button
                variant="destructive"
                className="h-12 font-bold"
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