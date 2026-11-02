import { useState } from "react"
import { Button } from "@/components/ui/button"
import { pesos } from "@/lib/format"
import { useStatsDias, useStatsTop } from "@/lib/queries"

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
    const hoy = lista.find((d) => d.dia === hoyISO())
    const maxDia = Math.max(1, ...lista.map((d) => d.cobrado_centavos))
    const maxPiezas = Math.max(1, ...(top.data ?? []).map((t) => t.piezas))
    const totalPeriodo = lista.reduce((a, d) => a + d.cobrado_centavos, 0)

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-4">
            <section className="rounded-xl border p-5 text-center">
                <p className="text-muted-foreground">Cobrado hoy</p>
                <p className="text-5xl font-bold text-green-600">{pesos(hoy?.cobrado_centavos ?? 0)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                    {hoy?.ordenes ?? 0} pedidos · Por cobrar {pesos(hoy?.pendiente_centavos ?? 0)}
                </p>
            </section>

            <div className="flex gap-2">
                {[7, 30].map((n) => (
                    <Button
                        key={n}
                        variant={dias === n ? "default" : "outline"}
                        className="h-12"
                        onClick={() => setDias(n)}
                    >
                        Últimos {n} días
                    </Button>
                ))}
            </div>

            <section>
                <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-lg font-semibold">Ventas por día</h2>
                    <span className="text-sm text-muted-foreground">Total {pesos(totalPeriodo)}</span>
                </div>
                {!lista.length ? (
                    <p className="text-muted-foreground">Todavía no hay ventas en este periodo</p>
                ) : (
                    <ul className="space-y-3">
                        {lista.map((d) => (
                            <li key={d.dia}>
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium capitalize">{nombreDia(d.dia)}</span>
                                    <span className="font-semibold">{pesos(d.cobrado_centavos)}</span>
                                </div>
                                <div className="mt-1 h-3 overflow-hidden rounded bg-muted">
                                    <div
                                        className="h-full rounded bg-primary"
                                        style={{ width: `${(d.cobrado_centavos / maxDia) * 100}%` }}
                                    />
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {d.ordenes} pedidos
                                    {d.pendiente_centavos > 0 && ` · por cobrar ${pesos(d.pendiente_centavos)}`}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section>
                <h2 className="mb-3 text-lg font-semibold">Lo más vendido</h2>
                {!top.data?.length ? (
                    <p className="text-muted-foreground">Sin datos todavía</p>
                ) : (
                    <ul className="space-y-3">
                        {top.data.map((t, i) => (
                            <li key={t.nombre}>
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium">
                                        {i + 1}. {t.nombre}
                                    </span>
                                    <span>
                                        {t.piezas} pzas · {pesos(t.ingresos_centavos)}
                                    </span>
                                </div>
                                <div className="mt-1 h-3 overflow-hidden rounded bg-muted">
                                    <div
                                        className="h-full rounded bg-green-600"
                                        style={{ width: `${(t.piezas / maxPiezas) * 100}%` }}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}