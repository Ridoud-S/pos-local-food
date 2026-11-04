import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Shield,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
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
import { Switch } from "@/components/ui/switch"
import { useMe } from "@/auth"
import { api } from "@/lib/api"
import { useUsuarios } from "@/lib/queries"
import type { Rol, Usuario } from "@/lib/types"
import { cn } from "@/lib/utils"

const ROLES: { id: Rol; nombre: string; descripcion: string; badgeColor: string }[] = [
  {
    id: "admin",
    nombre: "Administrador",
    descripcion: "Acceso total: Caja, Cuentas, Pedidos, Resumen y Usuarios",
    badgeColor: "bg-primary/15 text-primary border-primary/30",
  },
  {
    id: "caja",
    nombre: "Cajero",
    descripcion: "Acceso a Caja, Cuentas y Pedidos",
    badgeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  {
    id: "cocina",
    nombre: "Cocina",
    descripcion: "Acceso exclusivo al tablero de Pedidos en tiempo real",
    badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
]

export default function Usuarios() {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const { data: usuarios = [], isLoading, isError, refetch } = useUsuarios()

  // Estados de diálogos
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [eliminando, setEliminando] = useState<Usuario | null>(null)

  // Formulario creación
  const [nuevoUsuario, setNuevoUsuario] = useState("")
  const [nuevoPassword, setNuevoPassword] = useState("")
  const [nuevoRol, setNuevoRol] = useState<Rol>("caja")
  const [showNuevoPassword, setShowNuevoPassword] = useState(false)

  // Formulario edición
  const [editRol, setEditRol] = useState<Rol>("caja")
  const [editActivo, setEditActivo] = useState(true)
  const [editPassword, setEditPassword] = useState("")
  const [showEditPassword, setShowEditPassword] = useState(false)

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["usuarios"] })
  }

  // Mutación: Crear
  const crearMutation = useMutation({
    mutationFn: (data: { usuario: string; password: string; rol: Rol }) =>
      api<Usuario>("/admin/usuarios", { method: "POST", json: data }),
    onSuccess: (u) => {
      toast.success(`Usuario @${u.usuario} creado con éxito`)
      setCreando(false)
      setNuevoUsuario("")
      setNuevoPassword("")
      setNuevoRol("caja")
      refrescar()
    },
    onError: (e) => toast.error(e.message),
  })

  // Mutación: Actualizar
  const actualizarMutation = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: number
      password?: string
      rol?: Rol
      activo?: boolean
    }) => api<Usuario>(`/admin/usuarios/${id}`, { method: "PATCH", json: body }),
    onSuccess: (u) => {
      toast.success(`Usuario @${u.usuario} actualizado`)
      setEditando(null)
      refrescar()
      if (u.usuario.toLowerCase() === me?.usuario.toLowerCase()) {
        qc.invalidateQueries({ queryKey: ["me"] })
      }
    },
    onError: (e) => toast.error(e.message),
  })

  // Mutación: Eliminar
  const eliminarMutation = useMutation({
    mutationFn: (id: number) => api<void>(`/admin/usuarios/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Usuario eliminado")
      setEliminando(null)
      refrescar()
    },
    onError: (e) => toast.error(e.message),
  })

  const abrirEdicion = (u: Usuario) => {
    setEditando(u)
    setEditRol(u.rol)
    setEditActivo(u.activo)
    setEditPassword("")
    setShowEditPassword(false)
  }

  const handleCrearSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const u = nuevoUsuario.trim().toLowerCase()
    if (!u) {
      toast.error("Ingresa un nombre de usuario")
      return
    }
    if (u.length < 3 || u.length > 40) {
      toast.error("El usuario debe tener entre 3 y 40 caracteres")
      return
    }
    if (nuevoPassword.length < 8 || nuevoPassword.length > 72) {
      toast.error("La contraseña debe tener entre 8 y 72 caracteres")
      return
    }
    crearMutation.mutate({ usuario: u, password: nuevoPassword, rol: nuevoRol })
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editando) return
    const isSelf = editando.usuario.toLowerCase() === me?.usuario.toLowerCase()

    const payload: { password?: string; rol?: Rol; activo?: boolean } = {}
    if (!isSelf) {
      payload.rol = editRol
      payload.activo = editActivo
    }
    if (editPassword.trim()) {
      if (editPassword.length < 8 || editPassword.length > 72) {
        toast.error("La contraseña debe tener entre 8 y 72 caracteres")
        return
      }
      payload.password = editPassword
    }

    actualizarMutation.mutate({ id: editando.id, ...payload })
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 px-4 sm:px-6 py-3 sm:py-4 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Usuarios
              </h1>
              {usuarios.length > 0 && (
                <Badge variant="secondary" className="font-bold tabular-nums text-xs">
                  {usuarios.length}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Administración de cuentas y permisos del sistema
            </p>
          </div>
        </div>

        <Button
          type="button"
          className="min-h-[44px] h-11 px-4 gap-2 font-bold shadow-sm shadow-primary/20 rounded-xl"
          onClick={() => {
            setNuevoUsuario("")
            setNuevoPassword("")
            setNuevoRol("caja")
            setCreando(true)
          }}
        >
          <UserPlus className="size-4.5" />
          <span>Nuevo usuario</span>
        </Button>
      </div>

      {/* Main Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-8">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-2xl border border-border/50 bg-card/60 p-4"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
              <AlertCircle className="size-6" />
            </div>
            <h2 className="font-heading text-lg font-bold">Error al cargar usuarios</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              No se pudo obtener la lista de usuarios desde el servidor.
            </p>
            <Button variant="outline" className="mt-4 min-h-[44px]" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            {/* Vista en Lista de Tarjetas (Móvil y Tablet < lg) */}
            <div className="grid gap-3 lg:hidden">
              {usuarios.map((u) => {
                const isSelf = u.usuario.toLowerCase() === me?.usuario.toLowerCase()
                const rolInfo = ROLES.find((r) => r.id === u.rol)

                return (
                  <div
                    key={u.id}
                    className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-base font-bold text-foreground">
                            @{u.usuario}
                          </span>
                          {isSelf && (
                            <Badge className="bg-primary text-primary-foreground font-black text-[10px] px-2 py-0.5">
                              Tú
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{rolInfo?.descripcion}</p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Badge
                          variant="outline"
                          className={cn("text-xs font-bold border px-2 py-0.5", rolInfo?.badgeColor)}
                        >
                          {rolInfo?.nombre}
                        </Badge>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px] font-semibold",
                            u.activo
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          )}
                        >
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              u.activo ? "bg-emerald-500" : "bg-muted-foreground/40"
                            )}
                          />
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-2.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] h-11 px-3.5 gap-1.5 font-semibold text-xs rounded-xl"
                        onClick={() => abrirEdicion(u)}
                      >
                        <Pencil className="size-4" />
                        <span>Editar</span>
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "min-h-[44px] h-11 px-3.5 gap-1.5 font-semibold text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl",
                          isSelf && "opacity-40 pointer-events-none"
                        )}
                        disabled={isSelf}
                        onClick={() => setEliminando(u)}
                      >
                        <Trash2 className="size-4" />
                        <span>Eliminar</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Vista en Tabla (Desktop >= lg) */}
            <div className="hidden lg:block overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xs">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    <th className="py-3.5 px-5">Usuario</th>
                    <th className="py-3.5 px-5">Rol</th>
                    <th className="py-3.5 px-5">Estado</th>
                    <th className="py-3.5 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {usuarios.map((u) => {
                    const isSelf = u.usuario.toLowerCase() === me?.usuario.toLowerCase()
                    const rolInfo = ROLES.find((r) => r.id === u.rol)

                    return (
                      <tr key={u.id} className="transition-colors hover:bg-muted/20">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-base text-foreground">
                              @{u.usuario}
                            </span>
                            {isSelf && (
                              <Badge className="bg-primary text-primary-foreground font-black text-[10px] px-2 py-0.5">
                                Tú
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <Badge
                            variant="outline"
                            className={cn("text-xs font-bold border px-2.5 py-1", rolInfo?.badgeColor)}
                          >
                            {rolInfo?.nombre}
                          </Badge>
                        </td>

                        <td className="py-4 px-5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs font-bold",
                              u.activo
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                            )}
                          >
                            <span
                              className={cn(
                                "size-2.5 rounded-full",
                                u.activo ? "bg-emerald-500" : "bg-muted-foreground/40"
                              )}
                            />
                            {u.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>

                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-[44px] h-11 px-3.5 gap-1.5 font-semibold text-xs rounded-xl"
                              onClick={() => abrirEdicion(u)}
                            >
                              <Pencil className="size-4" />
                              <span>Editar</span>
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "min-h-[44px] h-11 px-3.5 gap-1.5 font-semibold text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl",
                                isSelf && "opacity-40 pointer-events-none"
                              )}
                              disabled={isSelf}
                              title={isSelf ? "No puedes eliminarte a ti mismo" : "Eliminar usuario"}
                              onClick={() => setEliminando(u)}
                            >
                              <Trash2 className="size-4" />
                              <span>Eliminar</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Diálogo: Nuevo Usuario (Bottom sheet en móvil) */}
      <Dialog open={creando} onOpenChange={(open) => !open && setCreando(false)}>
        <DialogContent className="max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-b-0 max-sm:max-h-[90dvh] max-sm:overflow-y-auto max-sm:p-5 p-6 sm:max-w-lg">
          <DialogHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <UserPlus className="size-5" />
              </div>
              <DialogTitle className="font-heading text-xl font-bold">
                Nuevo usuario
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Crea un nuevo acceso asignando su usuario, contraseña y rol en el POS.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCrearSubmit} className="space-y-4 pt-2">
            {/* Campo Usuario */}
            <div className="space-y-1.5">
              <Label htmlFor="nuevo-usuario" className="text-xs uppercase font-bold text-muted-foreground">
                Nombre de usuario
              </Label>
              <Input
                id="nuevo-usuario"
                className="h-11 sm:h-12 bg-card text-base rounded-xl"
                placeholder="ej. cajero_tarde"
                value={nuevoUsuario}
                onChange={(e) => setNuevoUsuario(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                autoComplete="off"
                required
                minLength={3}
                maxLength={40}
              />
              <span className="text-[11px] text-muted-foreground block">
                De 3 a 40 caracteres (letras, números, punto, guion o guion bajo).
              </span>
            </div>

            {/* Campo Contraseña con Botón Mostrar/Ocultar */}
            <div className="space-y-1.5">
              <Label htmlFor="nuevo-password" className="text-xs uppercase font-bold text-muted-foreground">
                Contraseña
              </Label>
              <div className="relative flex items-center">
                <Input
                  id="nuevo-password"
                  type={showNuevoPassword ? "text" : "password"}
                  className="h-11 sm:h-12 bg-card text-base rounded-xl pr-12"
                  placeholder="Mínimo 8 caracteres"
                  value={nuevoPassword}
                  onChange={(e) => setNuevoPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 size-10 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
                  aria-label={showNuevoPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  onClick={() => setShowNuevoPassword(!showNuevoPassword)}
                >
                  {showNuevoPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                </Button>
              </div>
              <span className="text-[11px] text-muted-foreground block">
                Mínimo 8 y máximo 72 caracteres.
              </span>
            </div>

            {/* Selector de Rol */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs uppercase font-bold text-muted-foreground">
                Rol y permisos
              </Label>
              <div className="space-y-2">
                {ROLES.map((r) => {
                  const seleccionado = nuevoRol === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setNuevoRol(r.id)}
                      className={cn(
                        "w-full min-h-[44px] flex items-start gap-3 p-3 rounded-xl border text-left transition-all active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        seleccionado
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border/80 bg-card hover:bg-muted/50"
                      )}
                    >
                      <div className="mt-0.5">
                        <div
                          className={cn(
                            "flex size-4.5 items-center justify-center rounded-full border-2",
                            seleccionado
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40"
                          )}
                        >
                          {seleccionado && <span className="size-2 rounded-full bg-primary-foreground" />}
                        </div>
                      </div>
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-sm font-bold text-foreground">
                            {r.nombre}
                          </span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", r.badgeColor)}>
                            {r.id}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug">
                          {r.descripcion}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] h-11 text-xs sm:text-sm font-semibold rounded-xl"
                disabled={crearMutation.isPending}
                onClick={() => setCreando(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="min-h-[44px] h-11 text-xs sm:text-sm font-bold shadow-md shadow-primary/20 rounded-xl"
                loading={crearMutation.isPending}
                disabled={crearMutation.isPending || !nuevoUsuario || !nuevoPassword}
              >
                Crear usuario
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Editar Usuario (Bottom sheet en móvil) */}
      <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent className="max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-b-0 max-sm:max-h-[90dvh] max-sm:overflow-y-auto max-sm:p-5 p-6 sm:max-w-lg">
          <DialogHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Pencil className="size-4.5" />
              </div>
              <DialogTitle className="font-heading text-xl font-bold">
                Editar usuario @{editando?.usuario}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Modifica los permisos, estado de actividad o actualiza la contraseña.
            </DialogDescription>
          </DialogHeader>

          {editando && (
            <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
              {/* Usuario actual es sí mismo */}
              {editando.usuario.toLowerCase() === me?.usuario.toLowerCase() && (
                <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/30 p-3 text-xs text-primary font-medium">
                  <Shield className="size-4.5 shrink-0" />
                  <span>
                    Estás editando tu propia cuenta. Por seguridad no puedes modificar tu rol ni desactivarte.
                  </span>
                </div>
              )}

              {/* Selector de Rol */}
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">
                  Rol asignado
                </Label>
                <div className="space-y-2">
                  {ROLES.map((r) => {
                    const isSelf = editando.usuario.toLowerCase() === me?.usuario.toLowerCase()
                    const seleccionado = editRol === r.id
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={isSelf}
                        onClick={() => !isSelf && setEditRol(r.id)}
                        className={cn(
                          "w-full min-h-[44px] flex items-start gap-3 p-3 rounded-xl border text-left transition-all active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          isSelf && "opacity-60 cursor-not-allowed",
                          seleccionado
                            ? "border-primary bg-primary/10 shadow-xs"
                            : "border-border/80 bg-card hover:bg-muted/50"
                        )}
                      >
                        <div className="mt-0.5">
                          <div
                            className={cn(
                              "flex size-4.5 items-center justify-center rounded-full border-2",
                              seleccionado
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/40"
                            )}
                          >
                            {seleccionado && <span className="size-2 rounded-full bg-primary-foreground" />}
                          </div>
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-sm font-bold text-foreground">
                              {r.nombre}
                            </span>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", r.badgeColor)}>
                              {r.id}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-snug">
                            {r.descripcion}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Interruptor Estado Activo */}
              <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card p-3.5">
                <div className="space-y-0.5 pr-2">
                  <Label htmlFor="switch-activo" className="font-heading font-bold text-sm text-foreground cursor-pointer">
                    Cuenta activa
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Los usuarios inactivos no pueden iniciar sesión en el POS.
                  </p>
                </div>
                <Switch
                  id="switch-activo"
                  checked={editActivo}
                  onCheckedChange={setEditActivo}
                  disabled={editando.usuario.toLowerCase() === me?.usuario.toLowerCase()}
                  aria-label="Estado de cuenta activa"
                />
              </div>

              {/* Nueva Contraseña (opcional) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-muted-foreground" />
                  <Label htmlFor="edit-password" className="text-xs uppercase font-bold text-muted-foreground">
                    Nueva contraseña (opcional)
                  </Label>
                </div>
                <div className="relative flex items-center">
                  <Input
                    id="edit-password"
                    type={showEditPassword ? "text" : "password"}
                    className="h-11 sm:h-12 bg-card text-base rounded-xl pr-12"
                    placeholder="Dejar en blanco para no cambiar"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 size-10 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
                    aria-label={showEditPassword ? "Ocultar contraseña" : "Ver contraseña"}
                    onClick={() => setShowEditPassword(!showEditPassword)}
                  >
                    {showEditPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                  </Button>
                </div>
                <span className="text-[11px] text-muted-foreground block">
                  Si deseas cambiarla, debe tener entre 8 y 72 caracteres.
                </span>
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] h-11 text-xs sm:text-sm font-semibold rounded-xl"
                  disabled={actualizarMutation.isPending}
                  onClick={() => setEditando(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="min-h-[44px] h-11 text-xs sm:text-sm font-bold shadow-md shadow-primary/20 rounded-xl"
                  loading={actualizarMutation.isPending}
                  disabled={actualizarMutation.isPending}
                >
                  Guardar cambios
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo: Confirmar Eliminación (Bottom sheet en móvil) */}
      <Dialog open={!!eliminando} onOpenChange={(open) => !open && setEliminando(null)}>
        <DialogContent className="max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-b-0 max-sm:max-h-[90dvh] max-sm:overflow-y-auto max-sm:p-5 p-6 sm:max-w-md">
          <div className="flex flex-col items-center text-center p-1">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <ShieldAlert className="size-6" />
            </div>
            <DialogHeader className="gap-1.5">
              <DialogTitle className="text-center font-heading text-xl font-bold">
                ¿Eliminar al usuario @{eliminando?.usuario}?
              </DialogTitle>
              <DialogDescription className="text-center text-xs sm:text-sm text-muted-foreground">
                Esta acción es irreversible y eliminará todos sus accesos al sistema inmediatamente.
              </DialogDescription>
            </DialogHeader>
          </div>

          <DialogFooter className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] h-11 text-xs sm:text-sm font-medium rounded-xl"
              disabled={eliminarMutation.isPending}
              onClick={() => setEliminando(null)}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-[44px] h-11 text-xs sm:text-sm font-bold rounded-xl"
              loading={eliminarMutation.isPending}
              disabled={eliminarMutation.isPending}
              onClick={() => eliminando && eliminarMutation.mutate(eliminando.id)}
            >
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
