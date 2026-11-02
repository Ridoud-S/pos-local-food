import { Loader2 } from "lucide-react"
import PorCobrar from "@/components/PorCobrar"
import { usePorCobrar } from "@/lib/queries"

export default function Pedidos() {
    const { data, isLoading } = usePorCobrar()
    const n = data?.length ?? 0

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b p-3">
                <h1 className="text-lg font-semibold">
                    Pedidos por cobrar{n > 0 ? ` · ${n}` : ""}
                </h1>
                {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <PorCobrar />
            </div>
        </div>
    )
}

