import { useState } from "react"
import { AlertCircle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import Cart from "@/components/Cart"
import ProductSheet from "@/components/ProductSheet"
import { pesos } from "@/lib/format"
import { useMenu } from "@/lib/queries"
import type { Producto } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function Caja() {
  const menu = useMenu()
  const [catId, setCatId] = useState<number | null>(null)
  const [producto, setProducto] = useState<Producto | null>(null)

  const categorias = menu.data ?? []
  const cat = categorias.find((c) => c.id === catId) ?? categorias[0]

  return (
    <div className="flex h-full flex-col p-3 lg:p-5">
      {menu.isLoading ? (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_390px] xl:grid-cols-[1fr_430px]">
          {/* Skeleton Categories & Products */}
          <div className="flex flex-col gap-4">
            <div className="flex gap-2 overflow-hidden py-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-12 w-28 animate-pulse rounded-full bg-muted/60"
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-2xl border border-border/40 bg-card/60 p-4"
                />
              ))}
            </div>
          </div>
          {/* Skeleton Cart */}
          <div className="hidden lg:block h-full animate-pulse rounded-3xl border border-border/40 bg-card/60" />
        </div>
      ) : menu.isError ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <AlertCircle className="size-7" />
          </div>
          <h2 className="font-heading text-xl font-bold text-foreground">
            Error al cargar el menú
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            No se pudo conectar con el servidor para obtener los productos.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => menu.refetch()}
          >
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_390px] xl:grid-cols-[1fr_430px]">
          {/* Products Column */}
          <div className="flex min-h-0 flex-col gap-4">
            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
              {categorias.map((c) => {
                const isActive = c.id === cat?.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCatId(c.id)}
                    className={cn(
                      "flex h-12 shrink-0 items-center justify-center rounded-full px-5 text-sm font-semibold transition-all duration-150 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-100"
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
              <div className="grid auto-rows-min grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 pb-4">
                {cat?.productos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProducto(p)}
                    className="group relative flex min-h-32 flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary outline-none"
                  >
                    <span className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
                      {p.nombre}
                    </span>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="font-heading font-bold text-base text-primary tabular-nums">
                        {pesos(p.precio_centavos)}
                      </span>
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-all duration-150 group-hover:bg-primary group-hover:text-primary-foreground group-active:scale-90">
                        <Plus className="size-4 stroke-[2.5]" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cart Column */}
          <div className="min-h-[22rem] lg:min-h-0">
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
