import { useState } from "react"
import { AlertCircle, Layers, Utensils, UtensilsCrossed } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OpcionesTab } from "@/components/menu-admin/OpcionesTab"
import { ProductosTab } from "@/components/menu-admin/ProductosTab"
import { useCatalogo } from "@/lib/queries"

export default function MenuAdmin() {
  const { data: catalogo, isLoading, isError, refetch } = useCatalogo()
  const [tabActiva, setTabActiva] = useState<string>("productos")

  const productosCount = catalogo?.productos?.length ?? 0
  const gruposCount = catalogo?.grupos?.length ?? 0

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/70 px-4 sm:px-6 py-3.5 sm:py-4 bg-card/50 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <UtensilsCrossed className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  Menú
                </h1>
                {catalogo && (
                  <Badge variant="secondary" className="font-bold tabular-nums text-xs">
                    {productosCount} {productosCount === 1 ? "producto" : "productos"}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Administración de productos, categorías, ingredientes y extras del POS
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-8">
        {isLoading ? (
          <div className="space-y-4 max-w-5xl mx-auto">
            {/* Tabs skeleton */}
            <div className="h-11 w-64 animate-pulse rounded-xl bg-muted/60" />
            {/* Search skeleton */}
            <div className="h-12 w-full max-w-md animate-pulse rounded-xl bg-muted/40" />
            {/* Cards skeleton */}
            <div className="space-y-3 pt-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl border border-border/50 bg-card/60 p-4"
                />
              ))}
            </div>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-12">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
              <AlertCircle className="size-6" />
            </div>
            <h2 className="font-heading text-lg font-bold">Error al cargar el catálogo</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              No se pudo obtener el catálogo completo desde el servidor. Verifica tu conexión o intenta nuevamente.
            </p>
            <Button
              variant="outline"
              className="mt-4 min-h-[44px] rounded-xl font-semibold text-xs"
              onClick={() => refetch()}
            >
              Reintentar
            </Button>
          </div>
        ) : catalogo ? (
          <div className="max-w-5xl mx-auto space-y-6">
            <Tabs
              value={tabActiva}
              onValueChange={setTabActiva}
              className="w-full space-y-6"
            >
              {/* Selector de pestañas */}
              <TabsList className="h-12 p-1 bg-muted/50 rounded-2xl border border-border/60">
                <TabsTrigger
                  value="productos"
                  className="min-h-[40px] px-4 sm:px-6 rounded-xl font-heading text-xs sm:text-sm font-bold gap-2 data-active:bg-card data-active:text-foreground data-active:shadow-xs transition-all"
                >
                  <Utensils className="size-4" />
                  <span>Productos</span>
                  <Badge
                    variant="outline"
                    className="ml-1 text-[11px] font-bold tabular-nums px-1.5 py-0 border-border"
                  >
                    {productosCount}
                  </Badge>
                </TabsTrigger>

                <TabsTrigger
                  value="opciones"
                  className="min-h-[40px] px-4 sm:px-6 rounded-xl font-heading text-xs sm:text-sm font-bold gap-2 data-active:bg-card data-active:text-foreground data-active:shadow-xs transition-all"
                >
                  <Layers className="size-4" />
                  <span>Opciones</span>
                  <Badge
                    variant="outline"
                    className="ml-1 text-[11px] font-bold tabular-nums px-1.5 py-0 border-border"
                  >
                    {gruposCount}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* Contenido Pestaña 1: Productos */}
              <TabsContent value="productos" className="mt-0 outline-none">
                <ProductosTab catalogo={catalogo} />
              </TabsContent>

              {/* Contenido Pestaña 2: Opciones */}
              <TabsContent value="opciones" className="mt-0 outline-none">
                <OpcionesTab catalogo={catalogo} />
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </div>
    </div>
  )
}

