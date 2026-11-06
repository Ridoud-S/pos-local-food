import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Props = {
  open: boolean
  title: string
  description?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDeactivateDialog({
  open,
  title,
  description = "Al desactivar este elemento, dejará de mostrarse en la Caja para nuevos pedidos. El historial de ventas y pedidos anteriores no se verá afectado.",
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-b-0 max-sm:p-5 p-6 sm:max-w-md">
        <div className="flex flex-col items-center text-center p-1">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-6" />
          </div>
          <DialogHeader className="gap-1.5">
            <DialogTitle className="text-center font-heading text-lg sm:text-xl font-bold">
              {title}
            </DialogTitle>
            <DialogDescription className="text-center text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <DialogFooter className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] h-11 text-xs sm:text-sm font-semibold rounded-xl"
            disabled={loading}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-[44px] h-11 text-xs sm:text-sm font-bold rounded-xl"
            loading={loading}
            disabled={loading}
            onClick={onConfirm}
          >
            Desactivar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

