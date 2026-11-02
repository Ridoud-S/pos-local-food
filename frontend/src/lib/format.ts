export const pesos = (centavos: number) =>
    (centavos / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })