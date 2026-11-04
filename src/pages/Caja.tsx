import { useState } from "react"
import { AlertCircle, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import Cart from "@/components/Cart"
import ProductSheet from "@/components/ProductSheet"
import { pesos } from "@/lib/format"
import { useMenu } from "@/lib/queries"
import type { Producto } from "@/lib/types"
import { useCart } from "@/store/cart"
import { cn } from "@/lib/utils"

export default function Caja() {
  const menu = useMenu()
  const { editando, cancelarEdicion, add } = useCart()
  const [catId, setCatId] = useState<number | null>(null)
  const [producto, setProducto] = useState<Producto | null>(null)
  const [animatingId, setAnimatingId] = useState<number | null>(null)

  function handleProductClick(p: Producto) {
    if (p.grupos.length === 0) {
      add({ producto: p, cantidad: 1, opciones: [], nota: "" })
      toast.success(`${p.nombre} agregado`, { duration: 1500 })
      setAnimatingId(p.id)
      setTimeout(() => {
        setAnimatingId((cur) => (cur === p.id ? null : cur))
      }, 300)
      return
    }
    setProducto(p)
  }

  const categorias = menu.data ?? []
  const cat = categorias.find((c) => c.id === catId) ?? categorias[0]

  return (
    <div className="flex h-full flex-col p-2.5 sm:p-3 lg:p-4 xl:p-5">
      {/* Banner de edición de pedido si está activo */}
      {editando && (
        <div className="mb-2.5 sm:mb-3 flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-3.5 sm:px-4 py-2 sm:py-2.5 shadow-xs animate-page-enter">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary shrink-0">
              <Plus className="size-4 stroke-[2.5]" />
            </div>
            <p className="font-heading font-bold text-xs sm:text-sm text-foreground truncate">
              Agregando al pedido #{editando.id}
              {editando.cliente ? ` · ${editando.cliente}` : ""}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-xs font-semibold hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            onClick={cancelarEdicion}
          >
            Cancelar edición
          </Button>
        </div>
      )}

      {menu.isLoading ? (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]">
          {/* Skeleton Categories & Products */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 overflow-hidden py-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-10 w-24 sm:w-28 animate-pulse rounded-full bg-muted/60"
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="h-28 sm:h-32 animate-pulse rounded-2xl border border-border/40 bg-card/60 p-3"
                />
              ))}
            </div>
          </div>
          {/* Skeleton Cart */}
          <div className="hidden lg:block h-full animate-pulse rounded-3xl border border-border/40 bg-card/60" />
        </div>
      ) : menu.isError ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="font-heading text-lg font-bold text-foreground">
            Error al cargar el menú
          </h2>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            No se pudo conectar con el servidor para obtener los productos.
          </p>
          <Button
            variant="outline"
            className="mt-4 h-10 text-xs font-semibold"
            onClick={() => menu.refetch()}
          >
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]">
          {/* Products Column */}
          <div className="flex min-h-0 flex-col gap-2.5 sm:gap-3">
            {/* Category Pills */}
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categorias.map((c) => {
                const isActive = c.id === cat?.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCatId(c.id)}
                    className={cn(
                      "flex h-9 sm:h-10 shrink-0 items-center justify-center rounded-full px-3.5 sm:px-4 text-xs font-semibold transition-all duration-150 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 scale-100"
                        : "border border-border/80 bg-card/70 text-foreground hover:bg-muted/80 hover:border-primary/40"
                    )}
                  >
                    {c.nombre}
                  </button>
                )
              })}
            </div>

            {/* Products Grid */}
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid auto-rows-min grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 xl:grid-cols-4 pb-20 lg:pb-4">
                {cat?.productos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProductClick(p)}
                    className={cn(
                      "group relative flex min-h-28 sm:min-h-32 flex-col justify-between rounded-2xl border border-border/80 bg-card p-3 sm:p-3.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md hover:shadow-primary/5 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary outline-none",
                      animatingId === p.id && "scale-[1.02] border-primary ring-2 ring-primary/40 shadow-md shadow-primary/10 transition-transform"
                    )}
                  >
                    <span className="font-semibold text-foreground text-xs sm:text-sm leading-snug line-clamp-2">
                      {p.nombre}
                    </span>

                    <div className="mt-2 sm:mt-3 flex items-center justify-between">
                      <span className="font-heading font-bold text-sm sm:text-base text-primary tabular-nums">
                        {pesos(p.precio_centavos)}
                      </span>
                      <div className="flex size-7 sm:size-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-all duration-150 group-hover:bg-primary group-hover:text-primary-foreground group-active:scale-90">
                        <Plus className="size-3.5 sm:size-4 stroke-[2.5]" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cart Column (desktop sidebar + mobile floating sheet) */}
          <div className="lg:h-full min-h-0">
            <Cart />
          </div>
        </div>
      )}

      {/* Product customization modal sheet */}
      {producto && (
        <ProductSheet
          key={producto.id}
          producto={producto}
          onClose={() => setProducto(null)}
        />
      )}
    </div>
  )
}
