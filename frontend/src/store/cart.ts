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
    cliente: string
    tipo: "local" | "llevar"
    editando: { id: number; cliente: string | null } | null
    add: (l: Omit<Linea, "key">) => void
    duplicar: (key: string) => void
    setCantidad: (key: string, cantidad: number) => void
    remove: (key: string) => void
    setCliente: (cliente: string) => void
    setTipo: (tipo: "local" | "llevar") => void
    iniciarEdicion: (id: number, cliente: string | null) => void
    cancelarEdicion: () => void
    clear: () => void
}

export const useCart = create<State>((set) => ({
    lineas: [],
    cliente: "",
    tipo: "llevar",
    editando: null,
    add: (l) =>
        set((s) => {
            const sinOpcionesNiNota =
                l.opciones.length === 0 && (!l.nota || l.nota.trim() === "")
            if (sinOpcionesNiNota) {
                const idx = s.lineas.findIndex(
                    (linea) =>
                        linea.producto.id === l.producto.id &&
                        linea.opciones.length === 0 &&
                        (!linea.nota || linea.nota.trim() === "")
                )
                if (idx !== -1) {
                    const newLineas = [...s.lineas]
                    newLineas[idx] = {
                        ...newLineas[idx],
                        cantidad: newLineas[idx].cantidad + l.cantidad,
                    }
                    return { lineas: newLineas }
                }
            }
            return { lineas: [...s.lineas, { ...l, key: `l${++contador}` }] }
        }),
    duplicar: (key) =>
        set((s) => {
            const item = s.lineas.find((l) => l.key === key)
            if (!item) return s
            const newLinea: Linea = {
                key: `l${++contador}`,
                producto: item.producto,
                cantidad: 1,
                opciones: [...item.opciones],
                nota: item.nota,
            }
            const idx = s.lineas.findIndex((l) => l.key === key)
            const newLineas = [...s.lineas]
            newLineas.splice(idx + 1, 0, newLinea)
            return { lineas: newLineas }
        }),
    setCantidad: (key, cantidad) =>
        set((s) => ({
            lineas: s.lineas.map((l) =>
                l.key === key ? { ...l, cantidad: Math.max(1, cantidad) } : l
            ),
        })),
    remove: (key) => set((s) => ({ lineas: s.lineas.filter((l) => l.key !== key) })),
    setCliente: (cliente) => set({ cliente }),
    setTipo: (tipo) => set({ tipo }),
    iniciarEdicion: (id, cliente) =>
        set({ editando: { id, cliente }, lineas: [], cliente: "" }),
    cancelarEdicion: () =>
        set({ editando: null, lineas: [], cliente: "" }),
    clear: () => set({ lineas: [], cliente: "" }),
}))

export const precioUnit = (l: Pick<Linea, "producto" | "opciones">) =>
    l.producto.precio_centavos + l.opciones.reduce((a, o) => a + o.precio_extra_centavos, 0)

export const totalCarrito = (lineas: Linea[]) =>
    lineas.reduce((a, l) => a + precioUnit(l) * l.cantidad, 0)
