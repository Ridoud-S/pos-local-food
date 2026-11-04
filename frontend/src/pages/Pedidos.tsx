import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  Maximize,
  Minimize,
  PackageCheck,
  ShoppingBag,
  Utensils,
  Volume2,
  VolumeX,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTablero } from "@/lib/queries"
import type { Orden } from "@/lib/types"
import { cn } from "@/lib/utils"

function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === "suspended") {
      ctx.resume()
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
    setTimeout(() => ctx.close().catch(() => {}), 500)
  } catch (err) {
    console.error("Audio error:", err)
  }
}

function formatMinutos(iso: string, now: number): string {
  if (!iso) return "< 1 min"
  const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000))
  if (min === 0) return "< 1 min"
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m}m`
}

function getColorTiempo(iso: string, now: number): string {
  if (!iso) return "text-foreground font-bold"
  const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000))
  if (min < 8) return "text-foreground font-bold"
  if (min <= 15) return "text-amber-500 dark:text-amber-400 font-extrabold"
  return "text-red-500 dark:text-red-400 font-black animate-pulse-subtle"
}

function renderTipoBadge(tipo: Orden["tipo"]) {
  if (tipo === "llevar") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-base sm:text-lg font-bold text-emerald-800 dark:text-emerald-200">
        <ShoppingBag className="size-5.5 shrink-0 stroke-[2.5]" />
        <span>PARA LLEVAR</span>
      </div>
    )
  }
  if (tipo === "domicilio") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/15 px-3 py-1.5 text-base sm:text-lg font-bold text-purple-800 dark:text-purple-200">
        <Bike className="size-5.5 shrink-0 stroke-[2.5]" />
        <span>DOMICILIO</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-base sm:text-lg font-bold text-blue-800 dark:text-blue-200">
      <Utensils className="size-5.5 shrink-0 stroke-[2.5]" />
      <span>COMER AQUÍ</span>
    </div>
  )
}

export default function Pedidos() {
  const { data, isLoading } = useTablero()
  const [sonidoActivo, setSonidoActivo] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement)
  const [ahora, setAhora] = useState(() => Date.now())
  const [nuevosMap, setNuevosMap] = useState<Record<number, number>>({})
  const prevIdsRef = useRef<Set<number> | null>(null)

  // Recalcular tiempo transcurrido cada 15 segundos
  useEffect(() => {
    const timer = setInterval(() => setAhora(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  // Fullscreen listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.error("Fullscreen error:", err)
    }
  }

  // Wake Lock con try/catch y re-petición al regresar a la pestaña visible
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null

    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          sentinel = await navigator.wakeLock.request("screen")
        }
      } catch {
        // Silencioso en caso de no soportado o denegado por el navegador
      }
    }

    requestWakeLock()

    const onVisChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock()
      }
    }

    document.addEventListener("visibilitychange", onVisChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisChange)
      if (sentinel) {
        sentinel.release().catch(() => {})
      }
    }
  }, [])

  // Detección de pedidos nuevos para beep y borde dorado
  useEffect(() => {
    if (!data) return
    const currentIds = new Set(data.map((o) => o.id))

    if (prevIdsRef.current === null) {
      // Primera carga: NO suena, guarda IDs existentes
      prevIdsRef.current = currentIds
      return
    }

    const nuevosIds = data.filter((o) => !prevIdsRef.current!.has(o.id)).map((o) => o.id)
    if (nuevosIds.length > 0) {
      if (sonidoActivo) {
        playBeep()
      }
      const now = Date.now()
      setNuevosMap((prev) => {
        const next = { ...prev }
        nuevosIds.forEach((id) => {
          next[id] = now
        })
        return next
      })
    }

    prevIdsRef.current = currentIds
  }, [data, sonidoActivo])

  // Ordenar: más viejo primero
  const ordenes = useMemo(() => {
    if (!data) return []
    return [...data].sort((a, b) => {
      const tA = Date.parse(a.creada_en) || 0
      const tB = Date.parse(b.creada_en) || 0
      return tA - tB || a.id - b.id
    })
  }, [data])

  const toggleSonido = () => {
    setSonidoActivo((prev) => {
      const next = !prev
      if (next) {
        playBeep()
      }
      return next
    })
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground select-none overflow-hidden">
      {/* Encabezado delgado: Pedidos · N, Pantalla completa, Sonido */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-border/80 bg-card/90 px-4 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex size-7.5 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Utensils className="size-4.5 stroke-[2.5]" />
          </div>
          <h1 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Pedidos · <span className="tabular-nums text-primary font-black">{ordenes.length}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón de Sonido */}
          <Button
            type="button"
            variant={sonidoActivo ? "default" : "outline"}
            size="sm"
            className={cn(
              "min-h-[44px] h-11 px-3.5 gap-2 text-xs sm:text-sm font-bold rounded-xl transition-all",
              sonidoActivo
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={toggleSonido}
            aria-label={sonidoActivo ? "Desactivar avisos de sonido" : "Activar avisos de sonido"}
            title={sonidoActivo ? "Sonido activado" : "Activar sonido para nuevos pedidos"}
          >
            {sonidoActivo ? <Volume2 className="size-5 shrink-0" /> : <VolumeX className="size-5 shrink-0" />}
            <span className="hidden sm:inline">{sonidoActivo ? "Sonido activado" : "Sonido apagado"}</span>
          </Button>

          {/* Botón de Pantalla Completa */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="min-h-[44px] min-w-[44px] size-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          </Button>
        </div>
      </header>

      {/* Contenido principal: Grilla de tarjetas o Estado vacío */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-6 pb-20 lg:pb-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))] gap-4 sm:gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-96 animate-pulse rounded-3xl border border-border/60 bg-card/60 p-5"
              />
            ))}
          </div>
        ) : ordenes.length === 0 ? (
          <div className="flex h-full min-h-[60vh] flex-col items-center justify-center p-6 text-center animate-page-enter">
            <div className="mb-4 flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-sm shadow-primary/10">
              <PackageCheck className="size-10 stroke-[1.8]" />
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              No hay pedidos pendientes
            </h2>
            <p className="mt-2 max-w-md text-base sm:text-lg text-muted-foreground font-medium">
              Los nuevos pedidos que se registren en caja aparecerán aquí al instante con aviso visual.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))] gap-4 sm:gap-6 items-start">
            {ordenes.map((o) => {
              const pagado = o.estado_pago === "pagado" && o.pendiente_centavos === 0
              const tNuevo = nuevosMap[o.id]
              const esNuevo = !!tNuevo && ahora - tNuevo < 10000

              return (
                <article
                  key={o.id}
                  className={cn(
                    "relative flex flex-col justify-between rounded-3xl border-2 bg-card p-4 sm:p-5 shadow-md transition-all duration-300",
                    esNuevo
                      ? "animate-new-order border-[#D4AF37]"
                      : "border-border/80 hover:border-border"
                  )}
                >
                  <div className="space-y-4">
                    {/* Fila superior: Número grande + Apodo cliente + Tiempo transcurrido grande */}
                    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2.5 flex-wrap">
                          <span className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-foreground tabular-nums">
                            #{o.id}
                          </span>
                          {o.cliente_nombre && (
                            <span className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight truncate max-w-[220px]">
                              · {o.cliente_nombre}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tiempo transcurrido */}
                      <div className="flex flex-col items-end shrink-0">
                        <span
                          className={cn(
                            "font-heading text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight",
                            getColorTiempo(o.creada_en, ahora)
                          )}
                        >
                          {formatMinutos(o.creada_en, ahora)}
                        </span>
                        <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground mt-0.5">
                          Espera
                        </span>
                      </div>
                    </div>

                    {/* Etiqueta de tipo grande y legible (Icono + Color) */}
                    <div>
                      {renderTipoBadge(o.tipo)}
                      {o.tipo === "domicilio" && o.direccion && (
                        <p className="mt-2 text-base sm:text-lg font-semibold text-foreground/90 bg-muted/40 p-2 rounded-xl border border-border/60">
                          {o.direccion}
                        </p>
                      )}
                    </div>

                    {/* Lista de productos */}
                    <ul className="space-y-4 border-t border-border/60 pt-3">
                      {o.items.map((it, idx) => (
                        <li key={idx} className="space-y-1.5 border-b border-border/40 pb-3 last:border-b-0 last:pb-0">
                          {/* Cantidad grande (2x) + Nombre de producto text-xl/text-2xl en negritas */}
                          <div className="flex items-baseline gap-2.5">
                            <span className="font-heading text-2xl sm:text-3xl font-black text-primary tabular-nums shrink-0">
                              {it.cantidad}×
                            </span>
                            <span className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                              {it.nombre}
                            </span>
                          </div>

                          {/* Opciones/ingredientes en text-lg con buen contraste */}
                          {it.opciones.length > 0 && (
                            <div className="pl-8 flex flex-wrap gap-1.5 pt-0.5">
                              {it.opciones.map((op, j) => (
                                <span
                                  key={j}
                                  className="inline-flex items-center rounded-lg bg-muted/80 px-2.5 py-1 text-base sm:text-lg font-semibold text-foreground border border-border/70"
                                >
                                  {op.nombre}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Notas de línea resaltadas con fondo de advertencia e ícono */}
                          {it.nota && (
                            <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-amber-500/50 bg-amber-500/20 p-2.5 text-base sm:text-lg font-bold text-amber-950 dark:text-amber-100 shadow-2xs">
                              <AlertTriangle className="size-5.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                              <span className="leading-snug">{it.nota}</span>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>

                    {/* Nota general del pedido */}
                    {o.nota && (
                      <div className="rounded-2xl border-2 border-amber-500/50 bg-amber-500/20 p-3 sm:p-3.5 text-base sm:text-lg font-bold text-amber-950 dark:text-amber-100 shadow-2xs">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="size-6 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                          <div className="space-y-0.5 leading-snug">
                            <span className="text-xs uppercase tracking-wider block font-black text-amber-800 dark:text-amber-300">
                              Nota general del pedido:
                            </span>
                            <span>{o.nota}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pie: Badge pequeño "Pagado" / "Por cobrar" (sin botones de acción) */}
                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <Badge
                      variant={pagado ? "secondary" : "destructive"}
                      className={cn(
                        "text-xs px-2.5 py-1 font-bold tracking-wide",
                        pagado
                          ? "bg-muted text-foreground border border-border/80"
                          : "bg-destructive text-destructive-foreground"
                      )}
                    >
                      {pagado ? "Pagado" : "Por cobrar"}
                    </Badge>

                    {pagado && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-4" />
                        Listo para preparar
                      </span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
