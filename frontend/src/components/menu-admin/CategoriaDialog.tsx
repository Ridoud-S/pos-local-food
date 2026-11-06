import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FolderPlus, Pencil } from "lucide-react"
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
import type { AdminCategoria } from "@/lib/types"

type Props = {
  open: boolean
  categoria?: AdminCategoria | null
  nextOrden?: number
  onClose: () => void
  onSuccess?: () => void
}

export function CategoriaDialog({
  open,
  categoria,
  nextOrden = 0,
  onClose,
  onSuccess,
}: Props) {
  const qc = useQueryClient()
  const [nombre, setNombre] = useState(categoria?.nombre ?? "")
  const [orden, setOrden] = useState<number>(categoria?.orden ?? nextOrden)

  const mutation = useMutation({
    mutationFn: async () => {
      const nom = nombre.trim()
      if (!nom) throw new Error("El nombre de la categoría es obligatorio")
      if (nom.length > 80) throw new Error("El nombre no puede tener más de 80 caracteres")

      if (categoria) {
        return api<{ id: number }>(`/admin/categorias/${categoria.id}`, {
          method: "PATCH",
          json: { nombre: nom, orden },
        })
      } else {
        return api<{ id: number }>("/admin/categorias", {
          method: "POST",
          json: { nombre: nom, orden },
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo"] })
      qc.invalidateQueries({ queryKey: ["menu"] })
      toast.success(
        categoria
          ? `Categoría "${nombre.trim()}" actualizada`
          : `Categoría "${nombre.trim()}" creada`
      )
      onSuccess?.()
      onClose()
    },
    onError: (e: Error) => {
      toast.error(e.message || "Error al guardar la categoría")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-b-0 max-sm:p-5 p-6 sm:max-w-md">
        <DialogHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              {categoria ? <Pencil className="size-4.5" /> : <FolderPlus className="size-4.5" />}
            </div>
            <DialogTitle className="font-heading text-lg sm:text-xl font-bold">
              {categoria ? "Editar categoría" : "Nueva categoría"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {categoria
              ? "Modifica el nombre o posición de esta categoría en el menú."
              : "Organiza tus productos en una nueva sección del menú."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="cat-nombre" className="text-xs uppercase font-bold text-muted-foreground">
              Nombre de la categoría <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cat-nombre"
              className="h-11 sm:h-12 bg-card text-base rounded-xl"
              placeholder="ej. Hamburguesas, Bebidas, Postres..."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              maxLength={80}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-orden" className="text-xs uppercase font-bold text-muted-foreground">
              Orden de aparición
            </Label>
            <Input
              id="cat-orden"
              type="number"
              className="h-11 sm:h-12 bg-card text-base rounded-xl"
              placeholder="0"
              value={orden}
              onChange={(e) => setOrden(parseInt(e.target.value, 10) || 0)}
            />
            <span className="text-[11px] text-muted-foreground block">
              Las categorías con menor número aparecen primero en la lista.
            </span>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] h-11 text-xs sm:text-sm font-semibold rounded-xl"
              disabled={mutation.isPending}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="min-h-[44px] h-11 text-xs sm:text-sm font-bold shadow-md shadow-primary/20 rounded-xl"
              loading={mutation.isPending}
              disabled={mutation.isPending || !nombre.trim()}
            >
              {categoria ? "Guardar cambios" : "Crear categoría"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
