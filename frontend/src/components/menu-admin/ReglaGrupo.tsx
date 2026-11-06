import { Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Props = {
  nombre: string
  min: number
  max: number
  onChange: (min: number, max: number) => void
  onRemove: () => void
}

export function ReglaGrupo({ nombre, min, max, onChange, onRemove }: Props) {
  // Determinar modo actual
  let modo: "single-required" | "single-optional" | "multiple" = "multiple"
  if (min === 1 && max === 1) {
    modo = "single-required"
  } else if (min === 0 && max === 1) {
    modo = "single-optional"
  }

  const handleSelectModo = (nuevoModo: "single-required" | "single-optional" | "multiple") => {
    if (nuevoModo === "single-required") {
      onChange(1, 1)
    } else if (nuevoModo === "single-optional") {
      onChange(0, 1)
    } else {
      // Modo varios: si venía de 1, sugerir min 0 max 3
      const nuevoMax = max > 1 ? max : 3
      const nuevoMin = min <= nuevoMax ? min : 0
      onChange(nuevoMin, nuevoMax)
    }
  }

  // Texto explicativo amigable
  const resumenRegla = (() => {
    if (min === 1 && max === 1) {
      return "Obligatorio: debe elegir exactamente 1 opción"
    }
    if (min === 0 && max === 1) {
      return "Opcional: puede elegir 1 opción o ninguna"
    }
    if (min === 0) {
      return `Opcional: puede elegir hasta ${max} opciones`
    }
    if (min === max) {
      return `Obligatorio: debe elegir exactamente ${min} opciones`
    }
    return `Debe elegir entre ${min} y ${max} opciones`
  })()

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 space-y-3 transition-colors hover:border-primary/40">
      {/* Encabezado del grupo */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-heading text-sm sm:text-base font-bold text-foreground">
              {nombre}
            </h4>
            <Badge
              variant={min > 0 ? "default" : "secondary"}
              className="text-[11px] font-semibold"
            >
              {min > 0 ? "Obligatorio" : "Opcional"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {resumenRegla}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          title="Quitar este grupo del producto"
          aria-label={`Quitar grupo ${nombre}`}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Selector de los 3 modos */}
      <div className="space-y-1.5 pt-1">
        <Label className="text-[11px] uppercase font-bold text-muted-foreground block">
          ¿Cómo debe elegir el cliente?
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => handleSelectModo("single-required")}
            className={cn(
              "flex min-h-[44px] items-center justify-center rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all border outline-none active:scale-[0.98]",
              modo === "single-required"
                ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                : "bg-muted/30 border-border/70 text-foreground hover:bg-muted/70"
            )}
          >
            Elegir 1 (obligatorio)
          </button>

          <button
            type="button"
            onClick={() => handleSelectModo("single-optional")}
            className={cn(
              "flex min-h-[44px] items-center justify-center rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all border outline-none active:scale-[0.98]",
              modo === "single-optional"
                ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                : "bg-muted/30 border-border/70 text-foreground hover:bg-muted/70"
            )}
          >
            Elegir 1 (opcional)
          </button>

          <button
            type="button"
            onClick={() => handleSelectModo("multiple")}
            className={cn(
              "flex min-h-[44px] items-center justify-center rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all border outline-none active:scale-[0.98]",
              modo === "multiple"
                ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                : "bg-muted/30 border-border/70 text-foreground hover:bg-muted/70"
            )}
          >
            Elegir varios
          </button>
        </div>
      </div>

      {/* Inputs numéricos para modo varios */}
      {modo === "multiple" && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50 animate-fadeIn">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">
              Mínimo de opciones
            </Label>
            <Input
              type="number"
              min={0}
              max={max}
              value={min}
              onChange={(e) => {
                const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                onChange(val, Math.max(val, max))
              }}
              className="h-11 bg-card text-base rounded-xl"
            />
            <span className="text-[11px] text-muted-foreground block">
              0 si no es forzoso elegir
            </span>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">
              Máximo de opciones
            </Label>
            <Input
              type="number"
              min={Math.max(1, min)}
              max={50}
              value={max}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value, 10) || 1)
                onChange(Math.min(min, val), val)
              }}
              className="h-11 bg-card text-base rounded-xl"
            />
            <span className="text-[11px] text-muted-foreground block">
              Límite a elegir
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
