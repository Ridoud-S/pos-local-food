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
import { api } from "@/lib/api"
import { pesos } from "@/lib/format"
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 sm:max-w-lg">
        {cambioFinal !== null ? (
          /* Payment completed screen with animated change */
          <div className="animate-page-enter space-y-6 py-6 text-center">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="size-12 animate-check stroke-[2.2]" />
            </div>

            <DialogHeader className="gap-1">
              <DialogTitle className="font-heading text-2xl font-bold tracking-tight text-foreground text-center">
                Pedido #{orden.id} Pagado
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground text-center">
                Monto de cambio a entregar al cliente
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              <p className="font-heading text-6xl font-extrabold text-success tabular-nums tracking-tight animate-pulse-subtle">
                {pesos(cambioFinal)}
              </p>
            </div>

            <Button
              size="lg"
              className="h-14 w-full text-base font-bold shadow-md shadow-primary/20"
              onClick={onClose}
            >
              Listo · Finalizar
            </Button>
          </div>
        ) : (
          /* Payment input screen */
          <div className="space-y-5">
            <DialogHeader className="gap-1">
              <div className="flex items-center justify-between">
                <DialogTitle className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  Cobrar Pedido #{orden.id}
                </DialogTitle>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                  Por pagar
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Selecciona el método de pago e ingresa el importe
              </DialogDescription>
            </DialogHeader>

            {/* Total Display */}
            <div className="rounded-2xl border border-primary/25 bg-primary/5 py-4 px-5 text-center">
              <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Total de la cuenta
              </span>
              <p className="font-heading text-5xl font-extrabold text-foreground tabular-nums tracking-tight mt-0.5">
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
                      "flex h-14 flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-xs font-semibold transition-all duration-150 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20 scale-100"
                        : "border-border/80 bg-card hover:bg-muted text-foreground"
                    )}
                  >
                    <Icon className="size-5" />
                    <span>{m.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Cash Input Controls */}
            {metodo === "efectivo" && (
              <div className="space-y-3.5 pt-1">
                {/* Received Cash Display */}
                <div className="flex items-center justify-between rounded-xl border border-input bg-card px-4 py-2.5">
                  <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Recibido
                  </span>
                  <span className="font-heading text-3xl font-bold tabular-nums text-foreground">
                    ${recibido || "0"}
                  </span>
                </div>

                {/* Quick Bill Shortcuts */}
                <div className="grid grid-cols-5 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 text-xs font-bold px-1"
                    onClick={() => setRecibido(String(orden.total / 100))}
                  >
                    Exacto
                  </Button>
                  {BILLETES.map((b) => (
                    <Button
                      key={b}
                      type="button"
                      variant="outline"
                      className="h-12 text-xs font-bold px-1"
                      onClick={() => setRecibido(String(b))}
                    >
                      ${b}
                    </Button>
                  ))}
                </div>

                {/* On-Screen Numeric Keypad (56px touch target buttons) */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map(
                    (digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleKeypad(digit)}
                        className="flex h-14 items-center justify-center rounded-xl border border-border/70 bg-card/80 text-xl font-heading font-bold text-foreground transition-all hover:bg-muted/70 active:scale-95 active:bg-primary/20"
                      >
                        {digit}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    aria-label="Borrar último dígito"
                    onClick={() => handleKeypad("backspace")}
                    className="flex h-14 items-center justify-center rounded-xl border border-border/70 bg-card/80 text-foreground transition-all hover:bg-destructive/15 hover:text-destructive active:scale-95"
                  >
                    <Delete className="size-6" />
                  </button>
                </div>

                {/* Real-Time Change / Pending Notice */}
                {recibidoC > 0 && (
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-2xl p-3.5 border transition-all",
                      cambio >= 0
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    )}
                  >
                    <span className="text-xs uppercase tracking-wider font-bold">
                      {cambio >= 0 ? "Cambio a entregar" : "Monto faltante"}
                    </span>
                    <span className="font-heading text-2xl font-extrabold tabular-nums">
                      {pesos(Math.abs(cambio))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Confirm Payment Button */}
            <Button
              size="lg"
              className="h-14 w-full text-base font-bold shadow-md shadow-primary/25 mt-2"
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
