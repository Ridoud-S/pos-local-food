import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Layers, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import type { AdminCatalogo } from "@/lib/types"
import { GrupoCard } from "./GrupoCard"

type Props = {
  catalogo: AdminCatalogo
}

export function OpcionesTab({ catalogo }: Props) {
  const qc = useQueryClient()
  const { grupos, opciones, productos, producto_grupos } = catalogo

  const [busqueda, setBusqueda] = useState("")
  const [modalNuevoGrupo, setModalNuevoGrupo] = useState(false)
  const [nombreNuevoGrupo, setNombreNuevoGrupo] = useState("")

  // Filtrado de grupos y sus opciones por búsqueda
  const gruposFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return grupos

    return grupos.filter((g) => {
      if (g.nombre.toLowerCase().includes(q)) return true
      const opcsDelGrupo = opciones.filter((o) => o.grupo_id === g.id)
      return opcsDelGrupo.some((o) => o.nombre.toLowerCase().includes(q))
    })
  }, [grupos, opciones, busqueda])

  // Mutación: Crear grupo
  const crearGrupoMutation = useMutation({
    mutationFn: (nombre: string) =>
      api<{ id: number }>("/admin/grupos", {
        method: "POST",
        json: { nombre },
      }),
    onSuccess: (_, nombre) => {
      qc.invalidateQueries({ queryKey: ["catalogo"] })
      qc.invalidateQueries({ queryKey: ["menu"] })
      toast.success(`Grupo "${nombre}" creado`)
      setNombreNuevoGrupo("")
      setModalNuevoGrupo(false)
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al crear el grupo")
    },
  })

  const handleCrearGrupo = (e: React.FormEvent) => {
    e.preventDefault()
    const nom = nombreNuevoGrupo.trim()
    if (!nom) {
      toast.error("El nombre del grupo es obligatorio")
      return
    }
    if (nom.length > 80) {
      toast.error("El nombre no puede tener más de 80 caracteres")
      return
    }
    crearGrupoMutation.mutate(nom)
  }

  return (
    <div className="space-y-6">
      {/* Barra de búsqueda y botón nuevo grupo */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar grupo u opción..."
            className="h-11 sm:h-12 pl-10 bg-card text-base rounded-xl"
          />
        </div>

        <Button
          type="button"
          className="min-h-[44px] h-11 px-4 gap-2 font-bold shadow-sm shadow-primary/20 rounded-xl"
          onClick={() => {
            setNombreNuevoGrupo("")
            setModalNuevoGrupo(true)
          }}
        >
          <Plus className="size-4.5" />
          <span>Nuevo grupo</span>
        </Button>
      </div>

      {/* Lista de grupos */}
      {gruposFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card p-8 text-center space-y-3">
          <Layers className="mx-auto size-8 text-muted-foreground/60" />
          <div>
            <h3 className="font-heading text-base font-bold text-foreground">
              No se encontraron grupos
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {busqueda
                ? `No hay grupos ni opciones que coincidan con "${busqueda}".`
                : "Aún no has creado ningún grupo de opciones."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] h-10 text-xs font-semibold rounded-xl"
            onClick={() => {
              if (busqueda) {
                setBusqueda("")
              } else {
                setNombreNuevoGrupo("")
                setModalNuevoGrupo(true)
              }
            }}
          >
            {busqueda ? "Limpiar búsqueda" : "Crear el primer grupo"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {gruposFiltrados.map((g) => {
            const opcsDelGrupo = opciones
              .filter((o) => o.grupo_id === g.id)
              .sort((a, b) => a.orden - b.orden)

            return (
              <GrupoCard
                key={g.id}
                grupo={g}
                opciones={opcsDelGrupo}
                productos={productos}
                productoGrupos={producto_grupos}
                defaultOpen={gruposFiltrados.length <= 3 || !!busqueda.trim()}
              />
            )
          })}
        </div>
      )}

      {/* Modal: Nuevo grupo */}
      <Dialog open={modalNuevoGrupo} onOpenChange={setModalNuevoGrupo}>
        <DialogContent className="max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-b-0 max-sm:p-5 p-6 sm:max-w-md">
          <DialogHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Layers className="size-4.5" />
              </div>
              <DialogTitle className="font-heading text-lg sm:text-xl font-bold">
                Nuevo grupo de opciones
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Agrupa opciones como aderezos, salsas, ingredientes o acompañamientos para tus productos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCrearGrupo} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="input-nom-grupo" className="text-xs uppercase font-bold text-muted-foreground">
                Nombre del grupo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="input-nom-grupo"
                className="h-11 sm:h-12 bg-card text-base rounded-xl"
                placeholder="ej. Aderezos, Término de la carne, Salsas..."
                value={nombreNuevoGrupo}
                onChange={(e) => setNombreNuevoGrupo(e.target.value)}
                autoFocus
                maxLength={80}
                required
              />
              <span className="text-[11px] text-muted-foreground block">
                Podrás agregar todas sus opciones de inmediato.
              </span>
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] h-11 text-xs sm:text-sm font-semibold rounded-xl"
                disabled={crearGrupoMutation.isPending}
                onClick={() => setModalNuevoGrupo(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="min-h-[44px] h-11 text-xs sm:text-sm font-bold shadow-md shadow-primary/20 rounded-xl"
                loading={crearGrupoMutation.isPending}
                disabled={crearGrupoMutation.isPending || !nombreNuevoGrupo.trim()}
              >
                Crear grupo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
