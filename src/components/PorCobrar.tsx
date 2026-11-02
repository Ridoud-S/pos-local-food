import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Banknote, Clock, PackageCheck, XCircle } from "lucide-react"
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
import { usePorCobrar } from "@/lib/queries"

function formatRelativo(iso: string, ahora: number): string {
  if (!iso) return ""
  const ms = ahora - Date.parse(iso)
  const min = Math.max(0, Math.floor(ms / 60000))
  if (min === 0) return "Justo ahora"
  if (min === 1) return "Hace 1 min"
  if (min < 60) return `Hace ${min} min`
  const h = Math.floor(min / 60)
  return `Hace ${h} h`
}

export default function PorCobrar() {
  const qc = useQueryClient()
  const { data, isLoading } = usePorCobrar()
  const [cobrar, setCobrar] = useState<{ id: number; total: number } | null>(null)
  const [cancelarId, setCancelarId] = useState<number | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  // Keep relative times fresh
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])

  const cancelar = useMutation({
    mutationFn: (id: number) => api(`/orders/${id}/cancelar`, { method: "PATCH" }),
    onSuccess: (_r, id) => {
      toast.success(`Pedido #${id} cancelado correctamente`)
      qc.invalidateQueries({ queryKey: ["orders"] })
      setCancelarId(null)
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
      <div className="flex h-full min-h-[50vh] flex-col items-center justify-center p-8 text-center animate-page-enter">
        <div className="mb-4 flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <PackageCheck className="size-10 stroke-[1.5]" />
        </div>
        <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Todos los pedidos están al día
        </h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          No hay cuentas pendientes por cobrar en este momento. Los nuevos pedidos aparecerán aquí automáticamente.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.map((o) => {
          const tipoLabel =
            o.tipo === "domicilio"
              ? "Domicilio"
              : o.tipo === "llevar"
              ? "Para llevar"
              : "Comer aquí"

          return (
            <div
              key={o.id}
              className="group animate-page-enter flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-150 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
            >
              <div>
                {/* Header: Order ID & Badges */}
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

                  <Badge variant="outline" className="font-medium text-xs">
                    {tipoLabel}
                  </Badge>
                </div>

                {/* Total Price */}
                <div className="py-3">
                  <span className="text-xs uppercase font-medium tracking-wider text-muted-foreground">
                    Total a cobrar
                  </span>
                  <p className="font-heading text-3xl font-extrabold text-foreground tabular-nums tracking-tight">
                    {pesos(o.total_centavos)}
                  </p>
                </div>

                {/* Items List */}
                <ul className="space-y-2 border-t border-border/40 pt-3 text-sm">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-primary tabular-nums">
                          {it.cantidad}×
                        </span>
                        <span className="font-medium text-foreground">
                          {it.nombre}
                        </span>
                      </div>
                      {it.opciones.length > 0 && (
                        <p className="text-xs text-muted-foreground pl-4">
                          {it.opciones.map((x) => x.nombre).join(" · ")}
                        </p>
                      )}
                      {it.nota && (
                        <p className="text-xs italic text-primary pl-4 font-medium">
                          “{it.nota}”
                        </p>
                      )}
                    </li>
                  ))}
                </ul>

                {o.nota && (
                  <p className="mt-3 rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground border border-border/40">
                    <span className="font-semibold text-foreground">Nota general:</span> {o.nota}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-5 grid grid-cols-[1fr_auto] gap-2 pt-3 border-t border-border/50">
                <Button
                  variant="default"
                  className="h-13 gap-2 font-bold text-sm shadow-sm"
                  onClick={() =>
                    setCobrar({ id: o.id, total: o.total_centavos })
                  }
                >
                  <Banknote className="size-5" />
                  Cobrar
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="size-13 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                  aria-label={`Cancelar pedido #${o.id}`}
                  title="Cancelar pedido"
                  onClick={() => setCancelarId(o.id)}
                >
                  <XCircle className="size-5" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Payment Dialog */}
      {cobrar && <PayDialog orden={cobrar} onClose={() => setCobrar(null)} />}

      {/* Cancellation Confirmation Dialog */}
      {cancelarId !== null && (
        <Dialog open onOpenChange={(open) => !open && setCancelarId(null)}>
          <DialogContent className="max-w-md">
            <div className="flex flex-col items-center text-center p-2">
              <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <AlertTriangle className="size-7" />
              </div>

              <DialogHeader className="gap-1">
                <DialogTitle className="font-heading text-xl font-bold text-center">
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
