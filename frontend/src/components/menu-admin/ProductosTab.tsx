import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Copy,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Utensils,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { api } from "@/lib/api"
import { pesos } from "@/lib/format"
import type {
  AdminCatalogo,
  AdminCategoria,
  AdminProducto,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { CategoriaDialog } from "./CategoriaDialog"
import { ConfirmDeactivateDialog } from "./ConfirmDeactivateDialog"
import { ProductoEditorSheet } from "./ProductoEditorSheet"

type Props = {
  catalogo: AdminCatalogo
}

export function ProductosTab({ catalogo }: Props) {
  const qc = useQueryClient()
  const { categorias, productos, grupos, producto_grupos } = catalogo

  // Buscador
  const [busqueda, setBusqueda] = useState("")

  // Estados de edición y diálogo
  const [editorAbierto, setEditorAbierto] = useState(false)
  const [productoAEditar, setProductoAEditar] = useState<AdminProducto | null>(null)
  const [categoriaDialogAbierta, setCategoriaDialogAbierta] = useState(false)
  const [categoriaAEditar, setCategoriaAEditar] = useState<AdminCategoria | null>(null)

  // Diálogo de confirmación para desactivación
  const [desactivandoProducto, setDesactivandoProducto] = useState<AdminProducto | null>(null)
  const [desactivandoCategoria, setDesactivandoCategoria] = useState<AdminCategoria | null>(null)

  // Mapa de grupos por producto para resumen "Ingredientes · Aderezos"
  const resumenGruposPorProducto = useMemo(() => {
    const mapa: Record<number, string> = {}
    const gruposMap = new Map(grupos.map((g) => [g.id, g.nombre]))

    for (const p of productos) {
      const vinculos = producto_grupos
        .filter((pg) => pg.producto_id === p.id)
        .sort((a, b) => a.orden - b.orden)

      if (vinculos.length === 0) {
        mapa[p.id] = "Sin opciones adicionales"
      } else {
        const nombres = vinculos
          .map((v) => gruposMap.get(v.grupo_id))
          .filter(Boolean)
        mapa[p.id] = nombres.join(" · ")
      }
    }
    return mapa
  }, [productos, grupos, producto_grupos])

  // Filtrado por buscador
  const categoriasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) {
      return [...categorias].sort((a, b) => a.orden - b.orden)
    }

    return categorias
      .map((cat) => {
        const prods = productos.filter(
          (p) =>
            p.categoria_id === cat.id &&
            p.nombre.toLowerCase().includes(q)
        )
        return { cat, prods }
      })
      .filter(({ prods, cat }) => prods.length > 0 || cat.nombre.toLowerCase().includes(q))
      .map(({ cat }) => cat)
      .sort((a, b) => a.orden - b.orden)
  }, [categorias, productos, busqueda])

  // Mutación: Activar/Desactivar Producto (con optimistic update y rollback)
  const toggleProductoActivoMutation = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      api<{ id: number }>(`/admin/productos/${id}`, {
        method: "PATCH",
        json: { activo },
      }),
    onMutate: async ({ id, activo }) => {
      await qc.cancelQueries({ queryKey: ["catalogo"] })
      const prevData = qc.getQueryData<AdminCatalogo>(["catalogo"])

      if (prevData) {
        qc.setQueryData<AdminCatalogo>(["catalogo"], {
          ...prevData,
          productos: prevData.productos.map((p) =>
            p.id === id ? { ...p, activo } : p
          ),
        })
      }
      return { prevData }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.prevData) {
        qc.setQueryData(["catalogo"], context.prevData)
      }
      toast.error(err.message || "Error al actualizar el producto")
    },
    onSuccess: (_, { activo }) => {
      qc.invalidateQueries({ queryKey: ["catalogo"] })
      qc.invalidateQueries({ queryKey: ["menu"] })
      toast.success(activo ? "Producto activado" : "Producto desactivado")
    },
  })

  // Mutación: Activar/Desactivar Categoría
  const toggleCategoriaActivaMutation = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      api<{ id: number }>(`/admin/categorias/${id}`, {
        method: "PATCH",
        json: { activo },
      }),
    onMutate: async ({ id, activo }) => {
      await qc.cancelQueries({ queryKey: ["catalogo"] })
      const prevData = qc.getQueryData<AdminCatalogo>(["catalogo"])

      if (prevData) {
        qc.setQueryData<AdminCatalogo>(["catalogo"], {
          ...prevData,
          categorias: prevData.categorias.map((c) =>
            c.id === id ? { ...c, activo } : c
          ),
        })
      }
      return { prevData }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.prevData) {
        qc.setQueryData(["catalogo"], context.prevData)
      }
      toast.error(err.message || "Error al actualizar la categoría")
    },
    onSuccess: (_, { activo }) => {
      qc.invalidateQueries({ queryKey: ["catalogo"] })
      qc.invalidateQueries({ queryKey: ["menu"] })
      toast.success(activo ? "Categoría activada" : "Categoría desactivada")
    },
  })

  // Duplicar producto
  const duplicarProducto = async (prod: AdminProducto) => {
    try {
      const nuevoNombre = `${prod.nombre} (copia)`
      // 1. Crear producto nuevo
      const res = await api<{ id: number }>("/admin/productos", {
        method: "POST",
        json: {
          categoria_id: prod.categoria_id,
          nombre: nuevoNombre,
          precio_centavos: prod.precio_centavos,
          orden: prod.orden + 1,
        },
      })

      // 2. Copiar vínculos existentes
      const vinculos = producto_grupos.filter((pg) => pg.producto_id === prod.id)
      for (const v of vinculos) {
        await api(`/admin/productos/${res.id}/grupos/${v.grupo_id}`, {
          method: "PUT",
          json: {
            min: v.min,
            max: v.max,
            orden: v.orden,
          },
        })
      }

      await qc.invalidateQueries({ queryKey: ["catalogo"] })
      await qc.invalidateQueries({ queryKey: ["menu"] })

      toast.success(`Producto duplicado como "${nuevoNombre}"`)

      // Abrir editor para permitir renombrarlo
      const nuevoProd: AdminProducto = {
        id: res.id,
        categoria_id: prod.categoria_id,
        nombre: nuevoNombre,
        precio_centavos: prod.precio_centavos,
        orden: prod.orden + 1,
        activo: true,
      }
      setProductoAEditar(nuevoProd)
      setEditorAbierto(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al duplicar el producto"
      toast.error(msg)
    }
  }

  const handleToggleProducto = (p: AdminProducto) => {
    if (p.activo) {
      // Confirmar antes de desactivar
      setDesactivandoProducto(p)
    } else {
      toggleProductoActivoMutation.mutate({ id: p.id, activo: true })
    }
  }

  const handleToggleCategoria = (c: AdminCategoria) => {
    if (c.activo) {
      setDesactivandoCategoria(c)
    } else {
      toggleCategoriaActivaMutation.mutate({ id: c.id, activo: true })
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra de búsqueda y acciones superiores */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto por nombre..."
            className="h-11 sm:h-12 pl-10 bg-card text-base rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] h-11 px-3.5 gap-2 font-semibold text-xs rounded-xl flex-1 sm:flex-initial"
            onClick={() => {
              setCategoriaAEditar(null)
              setCategoriaDialogAbierta(true)
            }}
          >
            <FolderPlus className="size-4.5" />
            <span>Nueva categoría</span>
          </Button>

          <Button
            type="button"
            className="min-h-[44px] h-11 px-4 gap-2 font-bold shadow-sm shadow-primary/20 rounded-xl flex-1 sm:flex-initial"
            onClick={() => {
              setProductoAEditar(null)
              setEditorAbierto(true)
            }}
          >
            <Plus className="size-4.5" />
            <span>Nuevo producto</span>
          </Button>
        </div>
      </div>

      {/* Lista de productos por categoría */}
      {categoriasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card p-8 text-center space-y-3">
          <Utensils className="mx-auto size-8 text-muted-foreground/60" />
          <div>
            <h3 className="font-heading text-base font-bold text-foreground">
              No se encontraron productos
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {busqueda
                ? `No hay productos que coincidan con "${busqueda}".`
                : "Aún no has creado categorías ni productos en el menú."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] h-10 text-xs font-semibold rounded-xl"
            onClick={() => {
              setBusqueda("")
              setProductoAEditar(null)
              setEditorAbierto(true)
            }}
          >
            {busqueda ? "Limpiar búsqueda" : "Crear el primer producto"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {categoriasFiltradas.map((cat) => {
            const q = busqueda.trim().toLowerCase()
            const prodsDeCat = productos
              .filter((p) => p.categoria_id === cat.id)
              .filter((p) => (!q ? true : p.nombre.toLowerCase().includes(q)))
              .sort((a, b) => a.orden - b.orden)

            return (
              <section
                key={cat.id}
                className={cn(
                  "rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs transition-opacity",
                  !cat.activo && "opacity-75 bg-card/60"
                )}
              >
                {/* Encabezado de la categoría */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/30 px-4 sm:px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-heading text-base sm:text-lg font-bold text-foreground">
                      {cat.nombre}
                    </h2>
                    <Badge variant="secondary" className="font-bold tabular-nums text-xs">
                      {prodsDeCat.length}
                    </Badge>
                    {!cat.activo && (
                      <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground border-border">
                        Inactiva en Caja
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2.5 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg"
                      onClick={() => {
                        setCategoriaAEditar(cat)
                        setCategoriaDialogAbierta(true)
                      }}
                    >
                      <Pencil className="size-3.5" />
                      <span>Renombrar</span>
                    </Button>

                    <div className="flex items-center gap-2 pl-2 border-l border-border/60">
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {cat.activo ? "Visible" : "Oculta"}
                      </span>
                      <Switch
                        checked={cat.activo}
                        onCheckedChange={() => handleToggleCategoria(cat)}
                        aria-label={`Estado de categoría ${cat.nombre}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Lista de productos de la categoría */}
                {prodsDeCat.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No hay productos en esta categoría.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {prodsDeCat.map((p) => {
                      const resumen = resumenGruposPorProducto[p.id] || "Sin opciones"

                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/30",
                            !p.activo && "opacity-60 bg-muted/15"
                          )}
                        >
                          {/* Datos del producto */}
                          <div
                            className="space-y-1 min-w-0 flex-1 cursor-pointer"
                            onClick={() => {
                              setProductoAEditar(p)
                              setEditorAbierto(true)
                            }}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-heading text-base font-bold text-foreground hover:text-primary transition-colors">
                                {p.nombre}
                              </span>
                              <span className="font-heading font-bold text-sm text-primary tabular-nums">
                                {pesos(p.precio_centavos)}
                              </span>
                              {!p.activo && (
                                <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground border-border">
                                  Inactivo
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {resumen}
                            </p>
                          </div>

                          {/* Acciones del producto */}
                          <div className="flex items-center justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="min-h-[44px] h-10 px-3 gap-1.5 font-semibold text-xs rounded-xl text-muted-foreground hover:text-foreground"
                              title="Duplicar este producto"
                              onClick={(e) => {
                                e.stopPropagation()
                                duplicarProducto(p)
                              }}
                            >
                              <Copy className="size-4" />
                              <span className="hidden md:inline">Duplicar</span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-[44px] h-10 px-3.5 gap-1.5 font-semibold text-xs rounded-xl"
                              onClick={() => {
                                setProductoAEditar(p)
                                setEditorAbierto(true)
                              }}
                            >
                              <Pencil className="size-4" />
                              <span>Editar</span>
                            </Button>

                            <div className="flex items-center gap-1.5 pl-1.5 border-l border-border/60">
                              <Switch
                                checked={p.activo}
                                onCheckedChange={() => handleToggleProducto(p)}
                                aria-label={`Estado activo de ${p.nombre}`}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* Sheet de edición de producto */}
      <ProductoEditorSheet
        key={productoAEditar ? `prod-${productoAEditar.id}` : `new-${editorAbierto ? 'open' : 'closed'}`}
        open={editorAbierto}
        producto={productoAEditar}
        categorias={categorias}
        grupos={grupos}
        productoGrupos={producto_grupos}
        nextOrden={productos.length}
        defaultCategoriaId={categorias[0]?.id}
        onClose={() => setEditorAbierto(false)}
        onDuplicate={(p) => duplicarProducto(p)}
      />

      {/* Diálogo de categoría (Crear / Renombrar) */}
      <CategoriaDialog
        key={categoriaAEditar ? `cat-${categoriaAEditar.id}` : `new-cat-${categoriaDialogAbierta ? 'open' : 'closed'}`}
        open={categoriaDialogAbierta}
        categoria={categoriaAEditar}
        nextOrden={categorias.length}
        onClose={() => setCategoriaDialogAbierta(false)}
      />

      {/* Confirmación al desactivar Producto */}
      <ConfirmDeactivateDialog
        open={!!desactivandoProducto}
        title={`¿Desactivar el producto "${desactivandoProducto?.nombre}"?`}
        description="Al desactivarlo, dejará de mostrarse en la Caja para nuevos pedidos. El historial de ventas y pedidos anteriores no se verá afectado."
        loading={toggleProductoActivoMutation.isPending}
        onConfirm={() => {
          if (desactivandoProducto) {
            toggleProductoActivoMutation.mutate(
              { id: desactivandoProducto.id, activo: false },
              {
                onSettled: () => setDesactivandoProducto(null),
              }
            )
          }
        }}
        onCancel={() => setDesactivandoProducto(null)}
      />

      {/* Confirmación al desactivar Categoría */}
      <ConfirmDeactivateDialog
        open={!!desactivandoCategoria}
        title={`¿Desactivar la categoría "${desactivandoCategoria?.nombre}"?`}
        description="Al desactivarla, sus productos no se mostrarán en la Caja para nuevos pedidos. No se borra ningún registro histórico."
        loading={toggleCategoriaActivaMutation.isPending}
        onConfirm={() => {
          if (desactivandoCategoria) {
            toggleCategoriaActivaMutation.mutate(
              { id: desactivandoCategoria.id, activo: false },
              {
                onSettled: () => setDesactivandoCategoria(null),
              }
            )
          }
        }}
        onCancel={() => setDesactivandoCategoria(null)}
      />
    </div>
  )
}
