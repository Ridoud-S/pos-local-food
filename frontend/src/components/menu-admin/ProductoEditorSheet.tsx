import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Copy, FolderPlus, Plus, Sparkles, Utensils } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "@/lib/api"
import { pesos } from "@/lib/format"
import type {
  AdminCategoria,
  AdminGrupo,
  AdminProducto,
  AdminProductoGrupo,
} from "@/lib/types"
import { ReglaGrupo } from "./ReglaGrupo"

type VinculoLocal = {
  grupo_id: number
  min: number
  max: number
  orden: number
}

type Props = {
  open: boolean
  producto: AdminProducto | null
  categorias: AdminCategoria[]
  grupos: AdminGrupo[]
  productoGrupos: AdminProductoGrupo[]
  nextOrden?: number
  defaultCategoriaId?: number
  onClose: () => void
  onDuplicate?: (p: AdminProducto) => void
}

export function ProductoEditorSheet({
  open,
  producto,
  categorias,
  grupos,
  productoGrupos,
  nextOrden = 0,
  defaultCategoriaId,
  onClose,
  onDuplicate,
}: Props) {
  const qc = useQueryClient()

  // Campos principales inicializados directamente
  const [nombre, setNombre] = useState(() => producto?.nombre ?? "")
  const [categoriaId, setCategoriaId] = useState<number>(() => {
    if (producto) return producto.categoria_id
    return defaultCategoriaId ?? (categorias[0]?.id || 0)
  })
  const [precioTexto, setPrecioTexto] = useState(() =>
    producto ? (producto.precio_centavos / 100).toString() : ""
  )
  const [orden, setOrden] = useState<number>(() => producto?.orden ?? nextOrden)

  // Vínculos locales del producto
  const [vinculos, setVinculos] = useState<VinculoLocal[]>(() => {
    if (!producto) return []
    return productoGrupos
      .filter((pg) => pg.producto_id === producto.id)
      .map((pg) => ({
        grupo_id: pg.grupo_id,
        min: pg.min,
        max: pg.max,
        orden: pg.orden,
      }))
  })

  // Modal para agregar grupo existente o crear uno nuevo
  const [modalAgregarGrupo, setModalAgregarGrupo] = useState(false)
  const [grupoSeleccionadoId, setGrupoSeleccionadoId] = useState<string>("")
  const [creandoNuevoGrupo, setCreandoNuevoGrupo] = useState(false)
  const [nombreNuevoGrupo, setNombreNuevoGrupo] = useState("")
  const [guardandoNuevoGrupo, setGuardandoNuevoGrupo] = useState(false)

  // Estado de guardado
  const [guardando, setGuardando] = useState(false)

  // Grupos disponibles para agregar (que no estén ya vinculados)
  const gruposDisponibles = grupos.filter(
    (g) => !vinculos.some((v) => v.grupo_id === g.id)
  )

  const handleUpdateRegla = (grupoId: number, min: number, max: number) => {
    setVinculos((prev) =>
      prev.map((v) => (v.grupo_id === grupoId ? { ...v, min, max } : v))
    )
  }

  const handleQuitarGrupo = (grupoId: number) => {
    setVinculos((prev) => prev.filter((v) => v.grupo_id !== grupoId))
  }

  const handleAgregarGrupoExistente = () => {
    const gid = parseInt(grupoSeleccionadoId, 10)
    if (!gid) return
    const nuevoOrden = vinculos.length
    setVinculos((prev) => [
      ...prev,
      { grupo_id: gid, min: 0, max: 1, orden: nuevoOrden },
    ])
    setGrupoSeleccionadoId("")
    setModalAgregarGrupo(false)
  }

  const handleCrearYVincularGrupo = async () => {
    const nom = nombreNuevoGrupo.trim()
    if (!nom) {
      toast.error("Ingresa el nombre del nuevo grupo")
      return
    }
    setGuardandoNuevoGrupo(true)
    try {
      const res = await api<{ id: number }>("/admin/grupos", {
        method: "POST",
        json: { nombre: nom },
      })
      qc.invalidateQueries({ queryKey: ["catalogo"] })
      qc.invalidateQueries({ queryKey: ["menu"] })

      const nuevoOrden = vinculos.length
      setVinculos((prev) => [
        ...prev,
        { grupo_id: res.id, min: 0, max: 1, orden: nuevoOrden },
      ])
      toast.success(`Grupo "${nom}" creado y vinculado`)
      setNombreNuevoGrupo("")
      setCreandoNuevoGrupo(false)
      setModalAgregarGrupo(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al crear el grupo"
      toast.error(msg)
    } finally {
      setGuardandoNuevoGrupo(false)
    }
  }

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones
    const nom = nombre.trim()
    if (!nom) {
      toast.error("El nombre del producto es obligatorio")
      return
    }
    if (nom.length > 80) {
      toast.error("El nombre no puede superar los 80 caracteres")
      return
    }
    if (!categoriaId) {
      toast.error("Selecciona una categoría válida")
      return
    }

    const precioNum = parseFloat(precioTexto)
    if (isNaN(precioNum) || precioNum < 0) {
      toast.error("Ingresa un precio válido (mayor o igual a 0)")
      return
    }
    const precioCentavos = Math.round(precioNum * 100)

    // Validar reglas de grupos
    for (const v of vinculos) {
      if (v.min < 0 || v.max < 1 || v.max < v.min) {
        toast.error("Las reglas de selección de grupos deben ser coherentes (mínimo >= 0, máximo >= 1 y máximo >= mínimo)")
        return
      }
    }

    setGuardando(true)

    try {
      if (!producto) {
        // CREACIÓN
        // 1. Crear producto
        const res = await api<{ id: number }>("/admin/productos", {
          method: "POST",
          json: {
            categoria_id: categoriaId,
            nombre: nom,
            precio_centavos: precioCentavos,
            orden,
          },
        })

        // 2. Vincular grupos en secuencia
        for (let i = 0; i < vinculos.length; i++) {
          const v = vinculos[i]
          await api(`/admin/productos/${res.id}/grupos/${v.grupo_id}`, {
            method: "PUT",
            json: {
              min: v.min,
              max: v.max,
              orden: i,
            },
          })
        }

        toast.success(`Producto "${nom}" creado con éxito`)
      } else {
        // EDICIÓN
        // 1. Actualizar producto
        await api<{ id: number }>(`/admin/productos/${producto.id}`, {
          method: "PATCH",
          json: {
            categoria_id: categoriaId,
            nombre: nom,
            precio_centavos: precioCentavos,
            orden,
          },
        })

        // 2. Grupos previos
        const gruposPrevios = productoGrupos
          .filter((pg) => pg.producto_id === producto.id)
          .map((pg) => pg.grupo_id)

        const gruposActuales = vinculos.map((v) => v.grupo_id)

        // Grupos a desvincular (DELETE)
        const gruposABorrar = gruposPrevios.filter((gid) => !gruposActuales.includes(gid))
        for (const gid of gruposABorrar) {
          await api(`/admin/productos/${producto.id}/grupos/${gid}`, {
            method: "DELETE",
          })
        }

        // Grupos a vincular o actualizar (PUT)
        for (let i = 0; i < vinculos.length; i++) {
          const v = vinculos[i]
          await api(`/admin/productos/${producto.id}/grupos/${v.grupo_id}`, {
            method: "PUT",
            json: {
              min: v.min,
              max: v.max,
              orden: i,
            },
          })
        }

        toast.success(`Producto "${nom}" actualizado`)
      }

      qc.invalidateQueries({ queryKey: ["catalogo"] })
      qc.invalidateQueries({ queryKey: ["menu"] })
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al guardar el producto"
      toast.error(msg)
      // Mantiene el editor abierto para no perder los cambios
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="bottom"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-xl sm:side-right max-h-[92dvh] rounded-t-3xl sm:rounded-none sm:h-full sm:max-h-full border-t sm:border-l sm:border-t-0"
        >
          {/* Header */}
          <SheetHeader className="border-b border-border/70 p-4 sm:p-5 bg-card/60 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 pr-8">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary shrink-0">
                  <Utensils className="size-5" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="font-heading text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                    {producto ? `Editar: ${producto.nombre}` : "Nuevo producto"}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                    {producto
                      ? "Modifica nombre, precio, categoría y opciones elegibles"
                      : "Configura el producto y lo que el cliente puede elegir"}
                  </SheetDescription>
                </div>
              </div>

              {producto && onDuplicate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] h-10 px-3 gap-1.5 text-xs font-semibold rounded-xl shrink-0"
                  title="Crear una copia de este producto"
                  onClick={() => onDuplicate(producto)}
                >
                  <Copy className="size-3.5" />
                  <span className="hidden sm:inline">Duplicar</span>
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Formulario */}
          <form
            id="producto-form"
            onSubmit={handleGuardar}
            className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-5"
          >
            {/* Sección 1: Información básica */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-nombre" className="text-xs uppercase font-bold text-muted-foreground">
                  Nombre del producto <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prod-nombre"
                  className="h-11 sm:h-12 bg-card text-base rounded-xl"
                  placeholder="ej. Hamburguesa Doble con Queso"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={80}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Categoría */}
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">
                    Categoría <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={categoriaId ? categoriaId.toString() : ""}
                    onValueChange={(val) => {
                      if (val) setCategoriaId(parseInt(val, 10))
                    }}
                  >
                    <SelectTrigger className="h-11 sm:h-12 w-full bg-card text-base rounded-xl">
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.nombre} {!c.activo && "(Inactiva)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Precio en pesos */}
                <div className="space-y-1.5">
                  <Label htmlFor="prod-precio" className="text-xs uppercase font-bold text-muted-foreground">
                    Precio en pesos ($ MXN) <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-muted-foreground font-bold text-sm">
                      $
                    </span>
                    <Input
                      id="prod-precio"
                      type="number"
                      step="0.50"
                      min="0"
                      className="h-11 sm:h-12 bg-card text-base rounded-xl pl-8 font-heading font-bold"
                      placeholder="0.00"
                      value={precioTexto}
                      onChange={(e) => setPrecioTexto(e.target.value)}
                      required
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    Equivale a{" "}
                    <strong className="text-foreground">
                      {pesos(Math.round((parseFloat(precioTexto) || 0) * 100))}
                    </strong>{" "}
                    base en Caja.
                  </span>
                </div>
              </div>

              {/* Orden */}
              <div className="space-y-1.5">
                <Label htmlFor="prod-orden" className="text-xs uppercase font-bold text-muted-foreground">
                  Orden en el menú
                </Label>
                <Input
                  id="prod-orden"
                  type="number"
                  className="h-11 sm:h-12 bg-card text-base rounded-xl max-w-xs"
                  placeholder="0"
                  value={orden}
                  onChange={(e) => setOrden(parseInt(e.target.value, 10) || 0)}
                />
                <span className="text-[11px] text-muted-foreground block">
                  Los productos con menor número se muestran primero dentro de su categoría.
                </span>
              </div>
            </div>

            {/* Separador */}
            <div className="border-t border-border/70 pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="font-heading text-base font-bold text-foreground">
                    ¿Qué se puede elegir en este producto?
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Ingredientes, aderezos, salsas, complementos o tamaños.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] h-10 px-3.5 gap-2 font-semibold text-xs rounded-xl shadow-xs"
                  onClick={() => {
                    setModalAgregarGrupo(true)
                    setCreandoNuevoGrupo(false)
                    setNombreNuevoGrupo("")
                    setGrupoSeleccionadoId("")
                  }}
                >
                  <Plus className="size-4" />
                  <span>Agregar grupo</span>
                </Button>
              </div>

              {/* Lista de grupos vinculados */}
              {vinculos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5 text-center">
                  <Sparkles className="mx-auto size-7 text-muted-foreground/60 mb-2" />
                  <p className="font-heading text-sm font-bold text-foreground">
                    Sin grupos vinculados
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-0.5">
                    Este producto se agregará a la orden directo al tocarlo en Caja, sin preguntar opciones.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 min-h-[44px] h-10 text-xs font-semibold rounded-xl"
                    onClick={() => {
                      setModalAgregarGrupo(true)
                      setCreandoNuevoGrupo(false)
                    }}
                  >
                    + Vincular ingredientes u opciones
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {vinculos.map((v) => {
                    const infoGrupo = grupos.find((g) => g.id === v.grupo_id)
                    const nombreGrupo = infoGrupo?.nombre ?? `Grupo #${v.grupo_id}`

                    return (
                      <ReglaGrupo
                        key={v.grupo_id}
                        nombre={nombreGrupo}
                        min={v.min}
                        max={v.max}
                        onChange={(nuevoMin, nuevoMax) =>
                          handleUpdateRegla(v.grupo_id, nuevoMin, nuevoMax)
                        }
                        onRemove={() => handleQuitarGrupo(v.grupo_id)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </form>

          {/* Footer de acción */}
          <SheetFooter className="gap-2.5 border-t border-border/80 bg-card/70 p-4 sm:p-5 backdrop-blur-md">
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] h-11 text-xs sm:text-sm font-semibold rounded-xl flex-1 sm:flex-initial"
                disabled={guardando}
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="producto-form"
                className="min-h-[44px] h-11 text-xs sm:text-sm font-bold shadow-md shadow-primary/20 rounded-xl flex-1 sm:flex-initial"
                loading={guardando}
                disabled={guardando || !nombre.trim()}
              >
                Guardar producto
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Diálogo: Agregar o Crear Grupo para vincular */}
      <Dialog open={modalAgregarGrupo} onOpenChange={setModalAgregarGrupo}>
        <DialogContent className="max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-b-0 max-sm:p-5 p-6 sm:max-w-md">
          <DialogHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Plus className="size-4.5" />
              </div>
              <DialogTitle className="font-heading text-lg sm:text-xl font-bold">
                {creandoNuevoGrupo ? "Crear nuevo grupo" : "Vincular grupo de opciones"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {creandoNuevoGrupo
                ? "Crea un grupo de opciones que podrás usar en este y otros productos."
                : "Elige un grupo existente o crea uno nuevo para este producto."}
            </DialogDescription>
          </DialogHeader>

          {!creandoNuevoGrupo ? (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">
                  Grupos disponibles
                </Label>
                {gruposDisponibles.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    Todos los grupos existentes ya están vinculados a este producto.
                  </p>
                ) : (
                  <Select
                    value={grupoSeleccionadoId}
                    onValueChange={(val) => setGrupoSeleccionadoId(val ?? "")}
                  >
                    <SelectTrigger className="h-11 sm:h-12 w-full bg-card text-base rounded-xl">
                      <SelectValue placeholder="Selecciona un grupo para agregar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {gruposDisponibles.map((g) => (
                        <SelectItem key={g.id} value={g.id.toString()}>
                          {g.nombre} {!g.activo && "(Inactivo)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground mb-2">
                  ¿No encuentras el grupo que buscas?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-[44px] h-10 text-xs font-semibold rounded-xl gap-2"
                  onClick={() => setCreandoNuevoGrupo(true)}
                >
                  <FolderPlus className="size-4" />
                  <span>Crear grupo nuevo aquí</span>
                </Button>
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] h-11 text-xs sm:text-sm font-semibold rounded-xl"
                  onClick={() => setModalAgregarGrupo(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="min-h-[44px] h-11 text-xs sm:text-sm font-bold shadow-md shadow-primary/20 rounded-xl"
                  disabled={!grupoSeleccionadoId}
                  onClick={handleAgregarGrupoExistente}
                >
                  Vincular grupo
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="nuevo-grupo-nom" className="text-xs uppercase font-bold text-muted-foreground">
                  Nombre del grupo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nuevo-grupo-nom"
                  className="h-11 sm:h-12 bg-card text-base rounded-xl"
                  placeholder="ej. Aderezos, Término de la carne, Salsas..."
                  value={nombreNuevoGrupo}
                  onChange={(e) => setNombreNuevoGrupo(e.target.value)}
                  autoFocus
                  maxLength={80}
                />
                <span className="text-[11px] text-muted-foreground block">
                  Podrás agregar las opciones y precios de este grupo en la pestaña "Opciones".
                </span>
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] h-11 text-xs sm:text-sm font-semibold rounded-xl"
                  disabled={guardandoNuevoGrupo}
                  onClick={() => setCreandoNuevoGrupo(false)}
                >
                  Volver a seleccionar
                </Button>
                <Button
                  type="button"
                  className="min-h-[44px] h-11 text-xs sm:text-sm font-bold shadow-md shadow-primary/20 rounded-xl"
                  loading={guardandoNuevoGrupo}
                  disabled={guardandoNuevoGrupo || !nombreNuevoGrupo.trim()}
                  onClick={handleCrearYVincularGrupo}
                >
                  Crear y vincular
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
