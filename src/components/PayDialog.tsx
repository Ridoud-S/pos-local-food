import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftRight, Banknote, CheckCircle2, CreditCard, Delete } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api, ApiError } from "@/lib/api"
import { pesos } from "@/lib/format"
import type { Orden } from "@/lib/types"
import { cn } from "@/lib/utils"

type Metodo = "efectivo" | "transferencia" | "tarjeta"
type Resp = { cambio_centavos: number }
type Props = { orden: { id: number; total: number }; onClose: () => void }

const BILLETES = [50, 100, 200, 500]
const METODOS: { id: Metodo; label: string; icon: typeof Banknote }[] = [
  { id: "efectivo", label: "Efectivo", icon: Banknote },
  { id: "transferencia", label: "Transferencia", icon: ArrowLeftRight },
  { id: "tarjeta", label: "Tarjeta", icon: CreditCard },
]

export default function PayDialog({ orden, onClose }: Props) {
  const qc = useQueryClient()
  const [metodo, setMetodo] = useState<Metodo>("efectivo")
  const [recibido, setRecibido] = useState("")
  const [cambioFinal, setCambioFinal] = useState<number | null>(null)

  const recibidoC = Math.round((parseFloat(recibido.replace(",", ".")) || 0) * 100)
  const cambio = recibidoC - orden.total
  const alcanza = metodo !== "efectivo" || recibidoC >= orden.total

  function cerrar() {
    qc.invalidateQueries({ queryKey: ["orders"] })
    onClose()
  }

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
      qc.setQueriesData<Orden[]>({ queryKey: ["orders"] }, (old) =>
        Array.isArray(old)
          ? old.map((o) => (o.id === orden.id ? { ...o, estado_pago: "pagado" } : o))
          : old,
      )
      qc.invalidateQueries({ queryKey: ["orders"] })
      qc.invalidateQueries({ queryKey: ["stats"] })
    },
    onError: (e) => {
      toast.error(e.message)
      if (e instanceof ApiError && e.status === 409) cerrar() // ya estaba pagada o cancelada
    },
  })

  function handleKeypad(digit: string) {
    if (digit === "clear") {
      setRecibido("")
      return
    }
    if (digit === "backspace") {
      setRecibido((prev) => prev.slice(0, -1))
      return
    }
    if (digit === ".") {
      if (!recibido.includes(".")) {
        setRecibido((prev) => (prev ? prev + "." : "0."))
      }
      return
    }
    // Limit decimal places to 2
    if (recibido.includes(".") && recibido.split(".")[1]?.length >= 2) {
      return
    }
    // Limit max value length
    if (recibido.length >= 8) return

    setRecibido((prev) => prev + digit)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && cerrar()}>
      <DialogContent className="w-full max-w-[calc(100%-1.5rem)] p-4 sm:p-5 sm:max-w-md max-h-[92dvh] overflow-y-auto gap-3">
        {cambioFinal !== null ? (
          /* Payment completed screen with animated change */
          <div className="animate-page-enter space-y-4 py-3 text-center">
            <div className="mx-auto flex size-14 sm:size-16 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="size-8 sm:size-10 animate-check stroke-[2.2]" />
            </div>

            <DialogHeader className="gap-0.5">
              <DialogTitle className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground text-center">
                Pedido #{orden.id} Pagado
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground text-center">
                Monto de cambio a entregar al cliente
              </DialogDescription>
            </DialogHeader>

            <div className="py-1">
              <p className="font-heading text-4xl sm:text-5xl font-extrabold text-success tabular-nums tracking-tight animate-pulse-subtle">
                {pesos(cambioFinal)}
              </p>
            </div>

            <Button
              size="lg"
              className="h-11 sm:h-12 w-full text-sm sm:text-base font-bold shadow-md shadow-primary/20"
              onClick={cerrar}
            >
              Listo · Finalizar
            </Button>
          </div>
        ) : (
          /* Payment input screen */
          <div className="space-y-3.5">
            <DialogHeader className="gap-0.5">
              <div className="flex items-center justify-between">
                <DialogTitle className="font-heading text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  Cobrar Pedido #{orden.id}
                </DialogTitle>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Por pagar
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Selecciona el método de pago e ingresa el importe
              </DialogDescription>
            </DialogHeader>

            {/* Total Display */}
            <div className="rounded-xl border border-primary/25 bg-primary/5 py-2.5 px-4 text-center">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Total de la cuenta
              </span>
              <p className="font-heading text-3xl sm:text-4xl font-extrabold text-foreground tabular-nums tracking-tight">
                {pesos(orden.total)}
              </p>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2">
              {METODOS.map((m) => {
                const Icon = m.icon
                const isActive = metodo === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetodo(m.id)}
                    className={cn(
                      "flex h-11 sm:h-12 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-xs font-semibold transition-all duration-150 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground font-bold shadow-sm shadow-primary/20 scale-100"
                        : "border-border/80 bg-card hover:bg-muted text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="text-[11px]">{m.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Cash Input Controls */}
            {metodo === "efectivo" && (
              <div className="space-y-2.5">
                {/* Received Cash Input */}
                <div className="flex items-center justify-between rounded-xl border border-input bg-card px-3 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Recibido
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-heading text-lg font-bold text-muted-foreground">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={recibido}
                      placeholder="0"
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, "")
                        setRecibido(val)
                      }}
                      className="w-24 sm:w-32 bg-transparent text-right font-heading text-xl sm:text-2xl font-bold tabular-nums text-foreground outline-none"
                    />
                  </div>
                </div>

                {/* Quick Bill Shortcuts */}
                <div className="grid grid-cols-5 gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-xs font-bold px-1"
                    onClick={() => setRecibido(String(orden.total / 100))}
                  >
                    Exacto
                  </Button>
                  {BILLETES.map((b) => (
                    <Button
                      key={b}
                      type="button"
                      variant="outline"
                      className="h-9 text-xs font-bold px-1"
                      onClick={() => setRecibido(String(b))}
                    >
                      ${b}
                    </Button>
                  ))}
                </div>

                {/* On-Screen Numeric Keypad: shown on tablet/desktop (md+) */}
                <div className="hidden md:grid grid-cols-3 gap-1.5 pt-1">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map(
                    (digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleKeypad(digit)}
                        className="flex h-11 items-center justify-center rounded-xl border border-border/70 bg-card/80 text-lg font-heading font-bold text-foreground transition-all hover:bg-muted/70 active:scale-95 active:bg-primary/20"
                      >
                        {digit}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    aria-label="Borrar último dígito"
                    onClick={() => handleKeypad("backspace")}
                    className="flex h-11 items-center justify-center rounded-xl border border-border/70 bg-card/80 text-foreground transition-all hover:bg-destructive/15 hover:text-destructive active:scale-95"
                  >
                    <Delete className="size-5" />
                  </button>
                </div>

                {/* Real-Time Change / Pending Notice */}
                {recibidoC > 0 && (
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-xl p-2.5 border transition-all text-xs",
                      cambio >= 0
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    )}
                  >
                    <span className="uppercase tracking-wider font-bold">
                      {cambio >= 0 ? "Cambio a entregar" : "Monto faltante"}
                    </span>
                    <span className="font-heading text-lg font-extrabold tabular-nums">
                      {pesos(Math.abs(cambio))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Confirm Payment Button */}
            <Button
              size="lg"
              className="h-11 sm:h-12 w-full text-sm sm:text-base font-bold shadow-md shadow-primary/25 mt-1"
              loading={pagar.isPending}
              disabled={!alcanza || pagar.isPending}
              onClick={() => pagar.mutate()}
            >
              Confirmar pago
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
