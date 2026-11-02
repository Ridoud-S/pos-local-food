import { create } from "zustand"
import type { Opcion, Producto } from "@/lib/types"

export type Linea = {
    key: string
    producto: Producto
    cantidad: number
    opciones: Opcion[]
    nota: string
}

let contador = 0 // no uso crypto.randomUUID: no existe en http desde la tablet

type State = {
    lineas: Linea[]
    add: (l: Omit<Linea, "key">) => void
    setCantidad: (key: string, cantidad: number) => void
    remove: (key: string) => void
    clear: () => void
}

export const useCart = create<State>((set) => ({
    lineas: [],
    add: (l) =>
        set((s) => ({ lineas: [...s.lineas, { ...l, key: `l${++contador}` }] })),
    setCantidad: (key, cantidad) =>
        set((s) => ({
            lineas:
                cantidad < 1
                    ? s.lineas.filter((l) => l.key !== key)
                    : s.lineas.map((l) => (l.key === key ? { ...l, cantidad } : l)),
        })),
    remove: (key) => set((s) => ({ lineas: s.lineas.filter((l) => l.key !== key) })),
    clear: () => set({ lineas: [] }),
}))

export const precioUnit = (l: Pick<Linea, "producto" | "opciones">) =>
    l.producto.precio_centavos + l.opciones.reduce((a, o) => a + o.precio_extra_centavos, 0)

export const totalCarrito = (lineas: Linea[]) =>
    lineas.reduce((a, l) => a + precioUnit(l) * l.cantidad, 0)
