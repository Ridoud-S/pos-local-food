import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Cart from "@/components/Cart"
import ProductSheet from "@/components/ProductSheet"
import { pesos } from "@/lib/format"
import { useMenu } from "@/lib/queries"
import type { Producto } from "@/lib/types"

export default function Caja() {
    const menu = useMenu()
    const [catId, setCatId] = useState<number | null>(null)
    const [producto, setProducto] = useState<Producto | null>(null)

    const categorias = menu.data ?? []
    const cat = categorias.find((c) => c.id === catId) ?? categorias[0]

    return (
        <div className="flex h-full flex-col">
            {menu.isLoading ? (
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : menu.isError ? (
                <p className="p-6 text-center text-destructive">No se pudo cargar el menú</p>
            ) : (
                <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[1fr_380px]">
                    <div className="flex min-h-0 flex-col gap-3">
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {categorias.map((c) => (
                                <Button
                                    key={c.id}
                                    variant={c.id === cat?.id ? "default" : "outline"}
                                    className="h-12 shrink-0 px-5 text-base"
                                    onClick={() => setCatId(c.id)}
                                >
                                    {c.nombre}
                                </Button>
                            ))}
                        </div>
                        <div className="grid auto-rows-min grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                            {cat?.productos.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setProducto(p)}
                                    className="flex min-h-28 flex-col items-start justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted active:bg-muted"
                                >
                                    <span className="text-base font-semibold leading-tight">{p.nombre}</span>
                                    <span className="text-lg font-bold">{pesos(p.precio_centavos)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="min-h-[24rem] lg:min-h-0">
                        <Cart />
                    </div>
                </div>
            )}

            {producto && (
                <ProductSheet key={producto.id} producto={producto} onClose={() => setProducto(null)} />
            )}
        </div>
    )
}
