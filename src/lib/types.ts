export type Me = { usuario: string; rol: string }

export type Opcion = {
    id: number
    nombre: string
    precio_extra_centavos: number
    es_default: boolean
}

export type Grupo = {
    id: number
    nombre: string
    min: number
    max: number
    opciones: Opcion[]
}

export type Producto = {
    id: number
    nombre: string
    precio_centavos: number
    grupos: Grupo[]
}

export type Categoria = {
    id: number
    nombre: string
    productos: Producto[]
}

export type ItemOrden = {
    nombre: string
    cantidad: number
    nota: string | null
    opciones: { grupo: string; nombre: string }[]
}

export type Orden = {
    id: number
    creada_en: string
    tipo: "local" | "llevar" | "domicilio"
    total_centavos: number
    estado_pago: "pendiente" | "pagado" | "cancelado"
    estado_cocina: "pendiente" | "en_preparacion" | "lista" | "en_camino" | "entregada"
    nota: string | null
    cliente_nombre: string | null
    direccion: string | null
    items: ItemOrden[]
}

export type DiaStats = {
    dia: string
    ordenes: number
    cobrado_centavos: number
    pendiente_centavos: number
}

export type TopProducto = {
    nombre: string
    piezas: number
    ingresos_centavos: number
}