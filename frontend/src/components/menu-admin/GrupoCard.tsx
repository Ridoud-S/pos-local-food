import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Pencil,
  Plus,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { api } from "@/lib/api"
import type {
  AdminCatalogo,
  AdminGrupo,
  AdminOpcion,
  AdminProducto,
  AdminProductoGrupo,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { ConfirmDeactivateDialog } from "./ConfirmDeactivateDialog"
import { OpcionRow } from "./OpcionRow"

type Props = {
  grupo: AdminGrupo
  opciones: AdminOpcion[]
  productos: AdminProducto[]
  productoGrupos: AdminProductoGrupo[]
  defaultOpen?: boolean
}

export function GrupoCard({
  grupo,
  opciones,
  productos,
  productoGrupos,
  defaultOpen = false,
}: Props) {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState(defaultOpen)

  // Edición del nombre del grupo
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nombreGrupo, setNombreGrupo] = useState(grupo.nombre)

  // Input rápido para agregar opción
  const [nuevaOpcionNombre, setNuevaOpcionNombre] = useState("")
  const [agregandoOpcion, setAgregandoOpcion] = useState(false)

  // Confirmación para desactivar grupo
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false)

  // Productos donde se usa este grupo
  const vinculosEsteGrupo = productoGrupos.filter((pg) => pg.grupo_id === grupo.id)
  const productosUsanGrupo = productos.filter((p) =>
    vinculosEsteGrupo.some((v) => v.producto_id === p.id)
  )

  // Mutación: Actualizar nombre o activo del grupo
  const patchGrupoMutation = useMutation({
    mutationFn: (body: { nombre?: string; activo?: boolean }) =>
      api<{ id: number }>(`/admin/grupos/${grupo.id}`, {
        method: "PATCH",
        json: body,
      }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["catalogo"] })
      const prevData = qc.getQueryData<AdminCatalogo>(["catalogo"])

      if (prevData) {
        qc.setQueryData<AdminCatalogo>(["catalogo"], {
          ...prevData,
          grupos: prevData.grupos.map((g) =>
            g.id === grupo.id ? { ...g, ...body } : g
          ),
        })
      }
      return { prevData }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.prevData) {
        qc.setQueryData(["catalogo"], context.prevData)
      }
      toast.error(err.message || "Error al actualizar el grupo")
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo"] })
      qc.invalidateQueries({ queryKey: ["menu"] })
    },
  })

  // Guardar nombre del grupo
  const guardarNombreGrupo = () => {
    const nom = nombreGrupo.trim()
    if (!nom) {
      toast.error("El nombre del grupo es obligatorio")
      return
    }
    patchGrupoMutation.mutate(
      { nombre: nom },
      {
        onSuccess: () => {
          setEditandoNombre(false)
          toast.success("Nombre del grupo actualizado")
        },
      }
    )
  }

  // Toggle activo
  const handleToggleActivo = () => {
    if (grupo.activo) {
      setConfirmarDesactivar(true)
    } else {
      patchGrupoMutation.mutate(
        { activo: true },
        {
          onSuccess: () => toast.success("Grupo activado"),
        }
      )
    }
  }

  // Agregar opción rápido
  const handleAgregarOpcionRapida = async (e: React.FormEvent) => {
    e.preventDefault()
    const nom = nuevaOpcionNombre.trim()
    if (!nom) return

    setAgregandoOpcion(true)
    try {
      const proximoOrden = opciones.length
      await api<{ id: number }>("/admin/opciones", {
        method: "POST",
        json: {
          grupo_id: grupo.id,
          nombre: nom,
          precio_extra_centavos: 0,
          es_default: false,
          orden: proximoOrden,
        },
      })

      qc.invalidateQueries({ queryKey: ["catalogo"] })
      qc.invalidateQueries({ queryKey: ["menu"] })
      setNuevaOpcionNombre("")
      toast.success(`Opción "${nom}" agregada`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al agregar la opción"
      toast.error(msg)
    } finally {
      setAgregandoOpcion(false)
    }
  }

  // Reordenar opciones con Up / Down
  const handleReordenar = async (indexA: number, indexB: number) => {
    const opcA = opciones[indexA]
    const opcB = opciones[indexB]
    if (!opcA || !opcB) return

    // Intercambiar órdenes
    const ordenA = opcB.orden
    const ordenB = opcA.orden === opcB.orden ? indexB : opcA.orden

    try {
      // Actualizar ambas opciones en paralelo
      await Promise.all([
        api(`/admin/opciones/${opcA.id}`, {
          method: "PATCH",
          json: { orden: ordenA },
        }),
        api(`/admin/opciones/${opcB.id}`, {
          method: "PATCH",
          json: { orden: ordenB },
        }),
      ])

      qc.invalidateQueries({ queryKey: ["catalogo"] })
      qc.invalidateQueries({ queryKey: ["menu"] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al reordenar las opciones"
      toast.error(msg)
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs transition-colors",
        !grupo.activo && "opacity-75 bg-card/60"
      )}
    >
      {/* Encabezado del grupo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:px-5 bg-muted/30 border-b border-border/70">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary shrink-0">
            <Layers className="size-4.5" />
          </div>

          {!editandoNombre ? (
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <h3
                className="font-heading text-base sm:text-lg font-bold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                onClick={() => setAbierto(!abierto)}
              >
                {grupo.nombre}
              </h3>
              <Badge variant="secondary" className="font-bold tabular-nums text-xs">
                {opciones.length} {opciones.length === 1 ? "opción" : "opciones"}
              </Badge>
              {!grupo.activo && (
                <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground border-border">
                  Inactivo
                </Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                title="Renombrar grupo"
                onClick={() => {
                  setNombreGrupo(grupo.nombre)
                  setEditandoNombre(true)
                }}
              >
                <Pencil className="size-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Input
                value={nombreGrupo}
                onChange={(e) => setNombreGrupo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") guardarNombreGrupo()
                  if (e.key === "Escape") setEditandoNombre(false)
                }}
                className="h-9 bg-card text-sm rounded-lg"
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                className="h-9 px-3 text-xs font-bold rounded-lg"
                onClick={guardarNombreGrupo}
                loading={patchGrupoMutation.isPending}
              >
                <Check className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 text-xs font-semibold rounded-lg"
                onClick={() => setEditandoNombre(false)}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>

        {/* Acciones y toggle desplegar */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {grupo.activo ? "Activo" : "Inactivo"}
            </span>
            <Switch
              checked={grupo.activo}
              onCheckedChange={handleToggleActivo}
              aria-label={`Estado activo del grupo ${grupo.nombre}`}
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[44px] h-9 px-2.5 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg"
            onClick={() => setAbierto(!abierto)}
            aria-expanded={abierto}
          >
            <span>{abierto ? "Ocultar" : "Ver opciones"}</span>
            {abierto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Subheader: Información de uso en productos */}
      <div className="px-4 sm:px-5 py-2.5 bg-muted/15 border-b border-border/50 text-xs">
        {productosUsanGrupo.length === 0 ? (
          <span className="text-muted-foreground">
            No se usa en ningún producto todavía. Puedes vincularlo desde el editor de productos.
          </span>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-foreground">Se usa en:</span>
              <span className="text-muted-foreground">
                {productosUsanGrupo.map((p) => p.nombre).join(", ")}
              </span>
            </div>

            {productosUsanGrupo.length >= 2 && (
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-medium pt-0.5">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>
                  Este grupo se usa en {productosUsanGrupo.length} productos. Cualquier cambio en sus opciones afectará a todos ellos.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cuerpo desplegable con lista de opciones */}
      {abierto && (
        <div className="p-4 sm:p-5 space-y-3 animate-fadeIn">
          {opciones.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Este grupo aún no tiene opciones configuradas.
            </p>
          ) : (
            <div className="space-y-2">
              {opciones.map((opc, idx) => (
                <OpcionRow
                  key={opc.id}
                  opcion={opc}
                  isFirst={idx === 0}
                  isLast={idx === opciones.length - 1}
                  onMoveUp={() => handleReordenar(idx, idx - 1)}
                  onMoveDown={() => handleReordenar(idx, idx + 1)}
                />
              ))}
            </div>
          )}

          {/* Input para agregar opción rápido */}
          <form
            onSubmit={handleAgregarOpcionRapida}
            className="flex items-center gap-2 pt-2 border-t border-border/60"
          >
            <Input
              value={nuevaOpcionNombre}
              onChange={(e) => setNuevaOpcionNombre(e.target.value)}
              placeholder="Escribe el nombre de la opción y presiona Enter..."
              className="h-11 bg-card text-base rounded-xl flex-1"
              disabled={agregandoOpcion}
            />
            <Button
              type="submit"
              className="min-h-[44px] h-11 px-4 gap-1.5 font-bold text-xs rounded-xl shadow-xs"
              loading={agregandoOpcion}
              disabled={agregandoOpcion || !nuevaOpcionNombre.trim()}
            >
              <Plus className="size-4" />
              <span>Agregar</span>
            </Button>
          </form>
          <span className="text-[11px] text-muted-foreground block">
            Al agregarla, se creará sin costo extra (+0). Podrás cambiar su precio extra o marcarla por defecto en cualquier momento.
          </span>
        </div>
      )}

      {/* Confirmación al desactivar grupo */}
      <ConfirmDeactivateDialog
        open={confirmarDesactivar}
        title={`¿Desactivar el grupo "${grupo.nombre}"?`}
        description={
          productosUsanGrupo.length > 0
            ? `Este grupo se usa en ${productosUsanGrupo.length} productos (${productosUsanGrupo.map((p) => p.nombre).slice(0, 3).join(", ")}${productosUsanGrupo.length > 3 ? "..." : ""}). Al desactivarlo, dejará de mostrarse en la Caja para nuevos pedidos. El historial de ventas no se afectará.`
            : "Al desactivar este grupo, no se mostrará en la Caja para nuevos pedidos. El historial de ventas y pedidos no se alterará."
        }
        loading={patchGrupoMutation.isPending}
        onConfirm={() => {
          patchGrupoMutation.mutate(
            { activo: false },
            {
              onSettled: () => setConfirmarDesactivar(false),
            }
          )
        }}
        onCancel={() => setConfirmarDesactivar(false)}
      />
    </div>
  )
}

