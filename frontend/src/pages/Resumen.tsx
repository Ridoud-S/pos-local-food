import { useState } from "react"
import { Calendar, DollarSign, Medal, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { pesos } from "@/lib/format"
import { useStatsDias, useStatsTop } from "@/lib/queries"
import { cn } from "@/lib/utils"

const nombreDia = (dia: string) =>
  new Date(dia + "T12:00:00").toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "short",
  })

function hoyISO() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(new Date())
  return p // YYYY-MM-DD
}

export default function Resumen() {
  const [dias, setDias] = useState(7)
  const stats = useStatsDias(dias)
  const top = useStatsTop(dias)

  const lista = stats.data ?? []
  const hoyStr = hoyISO()
  const hoy = lista.find((d) => d.dia === hoyStr)
  const maxDia = Math.max(1, ...lista.map((d) => d.cobrado_centavos))
  const maxPiezas = Math.max(1, ...(top.data ?? []).map((t) => t.piezas))
  const totalPeriodo = lista.reduce((a, d) => a + d.cobrado_centavos, 0)

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5 p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 animate-page-enter">
      {/* Hero Card: Cobrado hoy */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-primary/30 bg-gradient-to-b from-primary/10 via-card to-card p-4 sm:p-6 text-center shadow-md shadow-primary/5">
        <div className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-primary mb-1">
          <DollarSign className="size-3.5" />
          <span>Ingresos del día</span>
        </div>

        <p className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold text-primary tabular-nums tracking-tight">
          {pesos(hoy?.cobrado_centavos ?? 0)}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm">
          <span className="font-semibold text-foreground">
            {hoy?.ordenes ?? 0} {hoy?.ordenes === 1 ? "pedido cobrado" : "pedidos cobrados"}
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-muted-foreground">
            Por cobrar hoy:{" "}
            <span className="font-bold text-foreground tabular-nums">
              {pesos(hoy?.pendiente_centavos ?? 0)}
            </span>
          </span>
        </div>
      </section>

      {/* Period Filter Buttons */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-1.5">
          <Calendar className="size-4 text-muted-foreground" />
          <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
            Periodo:
          </span>
        </div>

        <div className="flex gap-1.5">
          {[7, 30].map((n) => (
            <Button
              key={n}
              variant={dias === n ? "default" : "outline"}
              className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-full text-xs font-bold"
              onClick={() => setDias(n)}
            >
              Últimos {n} días
            </Button>
          ))}
        </div>
      </div>

      {/* Ventas por día */}
      <section className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 sm:size-5 text-primary" />
            <h2 className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground">
              Ventas por día
            </h2>
          </div>
          <span className="font-heading text-xs sm:text-sm font-bold text-primary tabular-nums">
            Total: {pesos(totalPeriodo)}
          </span>
        </div>

        {!lista.length ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Todavía no hay ventas registradas en este periodo
          </p>
        ) : (
          <ul className="space-y-2.5">
            {lista.map((d) => {
              const isToday = d.dia === hoyStr
              const pct = Math.min(100, Math.max(3, (d.cobrado_centavos / maxDia) * 100))

              return (
                <li
                  key={d.dia}
                  className={cn(
                    "rounded-xl p-3 transition-colors border",
                    isToday
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/40 bg-card/60"
                  )}
                >
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground capitalize">
                        {nombreDia(d.dia)}
                      </span>
                      {isToday && (
                        <Badge variant="default" className="text-[9px] h-4.5 px-1.5 font-bold">
                          Hoy
                        </Badge>
                      )}
                    </div>
                    <span className="font-heading font-bold text-foreground tabular-nums text-sm sm:text-base">
                      {pesos(d.cobrado_centavos)}
                    </span>
                  </div>

                  {/* Visual Bar */}
                  <div className="mt-2 h-2.5 sm:h-3 overflow-hidden rounded-full bg-muted/60">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 ease-out",
                        isToday
                          ? "bg-gradient-to-r from-[#E6C75A] to-[#B8902A]"
                          : "bg-primary/80"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {d.ordenes} {d.ordenes === 1 ? "pedido" : "pedidos"}
                    </span>
                    {d.pendiente_centavos > 0 && (
                      <span className="font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                        Por cobrar: {pesos(d.pendiente_centavos)}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Lo más vendido */}
      <section className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
        <div className="mb-3.5 flex items-center gap-2 border-b border-border/50 pb-3">
          <Medal className="size-4 sm:size-5 text-primary" />
          <h2 className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground">
            Lo más vendido
          </h2>
        </div>

        {!top.data?.length ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Sin datos de productos en este periodo
          </p>
        ) : (
          <ul className="space-y-2.5">
            {top.data.map((t, i) => {
              const pos = i + 1
              const pct = Math.min(100, Math.max(3, (t.piezas / maxPiezas) * 100))

              return (
                <li
                  key={t.nombre}
                  className="rounded-xl border border-border/40 bg-card/60 p-3"
                >
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      {/* Medals for positions 1, 2, 3 */}
                      {pos === 1 ? (
                        <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-[#F5D77F] to-[#D4AF37] text-[#0B0B0C] font-bold text-[11px] shadow-xs">
                          1
                        </div>
                      ) : pos === 2 ? (
                        <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-[#E2E8F0] to-[#94A3B8] text-[#0B0B0C] font-bold text-[11px] shadow-xs">
                          2
                        </div>
                      ) : pos === 3 ? (
                        <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-[#FED7AA] to-[#EA580C] text-white font-bold text-[11px] shadow-xs">
                          3
                        </div>
                      ) : (
                        <div className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold text-[11px]">
                          {pos}
                        </div>
                      )}
                      <span className="font-semibold text-foreground text-xs sm:text-sm">
                        {t.nombre}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-foreground tabular-nums text-xs sm:text-sm">
                        {t.piezas} {t.piezas === 1 ? "pza" : "pzas"}
                      </span>
                      <span className="font-heading font-semibold text-primary tabular-nums text-xs sm:text-sm">
                        {pesos(t.ingresos_centavos)}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Visual Bar */}
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted/60">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 ease-out",
                        pos === 1
                          ? "bg-gradient-to-r from-[#E6C75A] to-[#B8902A]"
                          : pos === 2
                            ? "bg-gradient-to-r from-primary/70 to-primary/50"
                            : "bg-primary/40"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
