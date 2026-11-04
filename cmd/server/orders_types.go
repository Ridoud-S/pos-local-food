package main

import "time"

type OpcionOrden struct {
	Grupo  string `json:"grupo"`
	Nombre string `json:"nombre"`
}

type ItemOrden struct {
	Nombre   string        `json:"nombre"`
	Cantidad int           `json:"cantidad"`
	Nota     *string       `json:"nota"`
	Opciones []OpcionOrden `json:"opciones"`
}

type Orden struct {
	ID              int          `json:"id"`
	CreadaEn        time.Time    `json:"creada_en"`
	PagadaEn        *time.Time   `json:"pagada_en"`
	Tipo            string       `json:"tipo"`
	Total           int          `json:"total_centavos"`
	Envio           int          `json:"envio_centavos"`
	Abonado         int          `json:"abonado_centavos"`
	Pendiente       int          `json:"pendiente_centavos"`
	EstadoPago      string       `json:"estado_pago"`
	EstadoCocina    string       `json:"estado_cocina"`
	MetodoPago      *string      `json:"metodo_pago"`
	MontoRecibido   *int         `json:"monto_recibido_centavos"`
	Nota            *string      `json:"nota"`
	ClienteNombre   *string      `json:"cliente_nombre"`
	ClienteTelefono *string      `json:"cliente_telefono"`
	Direccion       *string      `json:"direccion"`
	Referencias     *string      `json:"referencias"`
	Items           []*ItemOrden `json:"items"`
}

// Inicio del día actual en hora de México
const hoyWhere = `creada_en >= (date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City')`

func estadoTexto(e string) string {
	switch e {
	case "pagado":
		return "pagada"
	case "cancelado":
		return "cancelada"
	}
	return e
}
