import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, Check, DollarSign, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { api } from "@/lib/api"
import { pesos } from "@/lib/format"
import type { AdminCatalogo, AdminOpcion } from "@/lib/types"
import { cn } from "@/lib/utils"

type Props = {
  opcion: AdminOpcion
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}

export function OpcionRow({
  opcion,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: Props) {
  const qc = useQueryClient()

  // Edición rápida inline de nombre y precio
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(opcion.nombre)
  const [precioTexto, setPrecioTexto] = useState(
    (opcion.precio_extra_centavos / 100).toString()
  )

  // Mutación: Actualizar propiedades de la opción
  const patchOpcionMutation = useMutation({
    mutationFn: (body: Partial<AdminOpcion>) =>
      api<{ id: number }>(`/admin/opciones/${opcion.id}`, {
        method: "PATCH",
        json: body,
      }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["catalogo"] })
      const prevData = qc.getQueryData<AdminCatalogo>(["catalogo"])

      if (prevData) {
        qc.setQueryData<AdminCatalogo>(["catalogo"], {
          ...prevData,
          opciones: prevData.opciones.map((o) =>
            o.id === opcion.id ? { ...o, ...body } : o
          ),
        })
      }
      return { prevData }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.prevData) {
        qc.setQueryData(["catalogo"], context.prevData)
      }
      toast.error(err.message || "Error al actualizar la opción")
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo"] })
      qc.invalidateQueries({ queryKey: ["menu"] })
    },
  })

  const guardarEdicion = () => {
    const nom = nombre.trim()
    if (!nom) {
      toast.error("El nombre de la opción no puede estar vacío")
      return
    }
    const precioNum = parseFloat(precioTexto)
    if (isNaN(precioNum) || precioNum < 0) {
      toast.error("El precio extra debe ser mayor o igual a 0")
      return
    }
    const precioExtraCentavos = Math.round(precioNum * 100)

    patchOpcionMutation.mutate(
      {
        nombre: nom,
        precio_extra_centavos: precioExtraCentavos,
      },
      {
        onSuccess: () => {
          setEditando(false)
          toast.success("Opción actualizada")
        },
      }
    )
  }

  const handleToggleDefault = (checked: boolean) => {
    patchOpcionMutation.mutate({ es_default: checked })
  }

  const handleToggleActivo = (checked: boolean) => {
    patchOpcionMutation.mutate({ activo: checked })
  }

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:px-4 rounded-xl border border-border/70 bg-card transition-colors",
        !opcion.activo && "opacity-60 bg-muted/20 border-dashed"
      )}
    >
      {/* Vista Normal / Modo Edición */}
      {!editando ? (
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Reordenar subir / bajar */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
              disabled={isFirst}
              title="Subir opción"
              aria-label="Subir opción"
              onClick={onMoveUp}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
              disabled={isLast}
              title="Bajar opción"
              aria-label="Bajar opción"
              onClick={onMoveDown}
            >
              <ArrowDown className="size-4" />
            </Button>
          </div>

          {/* Información de la opción */}
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-heading text-sm font-bold text-foreground">
                {opcion.nombre}
              </span>
              <span className="text-xs font-heading font-bold text-primary tabular-nums">
                {opcion.precio_extra_centavos > 0
                  ? `+${pesos(opcion.precio_extra_centavos)}`
                  : "Sin costo"}
              </span>
              {opcion.es_default && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  <Check className="size-3" /> Viene marcada
                </span>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground shrink-0 rounded-lg"
            title="Editar nombre y precio extra"
            onClick={() => {
              setNombre(opcion.nombre)
              setPrecioTexto((opcion.precio_extra_centavos / 100).toString())
              setEditando(true)
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="h-10 bg-card text-sm rounded-lg flex-1"
            placeholder="Nombre de la opción"
            autoFocus
          />
          <div className="relative flex items-center w-full sm:w-32">
            <DollarSign className="absolute left-2.5 size-3.5 text-muted-foreground" />
            <Input
              type="number"
              step="0.50"
              min="0"
              value={precioTexto}
              onChange={(e) => setPrecioTexto(e.target.value)}
              className="h-10 bg-card text-sm rounded-lg pl-7 tabular-nums"
              placeholder="0.00"
            />
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              className="h-10 px-3 text-xs font-bold rounded-lg"
              onClick={guardarEdicion}
              loading={patchOpcionMutation.isPending}
            >
              Guardar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 px-3 text-xs font-semibold rounded-lg"
              onClick={() => setEditando(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Controles: Viene marcada y Activo */}
      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
        <label
          htmlFor={`default-opc-${opcion.id}`}
          className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground"
        >
          <Switch
            id={`default-opc-${opcion.id}`}
            checked={opcion.es_default}
            onCheckedChange={handleToggleDefault}
            aria-label={`Marcar ${opcion.nombre} por defecto`}
          />
          <span className="text-[11px] text-muted-foreground">Viene marcada</span>
        </label>

        <div className="flex items-center gap-1.5 pl-3 border-l border-border/60">
          <span className="text-[11px] text-muted-foreground hidden md:inline">
            {opcion.activo ? "Activa" : "Inactiva"}
          </span>
          <Switch
            checked={opcion.activo}
            onCheckedChange={handleToggleActivo}
            aria-label={`Estado activo de opción ${opcion.nombre}`}
          />
        </div>
      </div>
    </div>
  )
}

