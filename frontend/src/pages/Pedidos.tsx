import { ClipboardList, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import PorCobrar from "@/components/PorCobrar"
import { usePedidosActivos } from "@/lib/queries"

export default function Pedidos() {
  const { data, isLoading, isFetching, refetch } = usePedidosActivos()
  const n = data?.length ?? 0

  return (
    <div className="flex h-full flex-col">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 bg-card/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
                Pedidos
              </h1>
              {n > 0 && (
                <Badge variant="default" className="font-bold tabular-nums">
                  {n}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pedidos activos en el local
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-11 rounded-xl text-muted-foreground hover:text-foreground"
          aria-label="Actualizar lista de pedidos"
          title="Actualizar pedidos"
          disabled={isLoading}
          onClick={() => refetch()}
        >
          <RefreshCw className={`size-4.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PorCobrar />
      </div>
    </div>
  )
}
