import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useLogin, useMe } from "@/auth"
import { BUSINESS_NAME } from "@/components/Layout"

export default function Login() {
  const navigate = useNavigate()
  const me = useMe()
  const login = useLogin()
  const [usuario, setUsuario] = useState("")
  const [password, setPassword] = useState("")

  if (me.data) {
    const home = me.data.rol === "cocina" ? "/pedidos" : "/"
    return <Navigate to={home} replace />
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    login.mutate(
      { usuario: usuario.trim(), password },
      {
        onSuccess: (userData) => {
          const home = userData.rol === "cocina" ? "/pedidos" : "/"
          navigate(home, { replace: true })
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center p-4 bg-background overflow-hidden">
      {/* Subtle radial gold aura in background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />

      {/* Theme toggle in top right corner */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
        <ThemeToggle />
      </div>

      <Card className="relative w-full max-w-sm border border-primary/30 bg-card/90 backdrop-blur-xl shadow-2xl shadow-black/20 rounded-3xl p-1 sm:p-2 animate-page-enter">
        <CardHeader className="text-center pb-2 pt-5 sm:pt-6">
          <div className="mx-auto mb-2.5 flex size-12 sm:size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E6C75A] to-[#B8902A] text-[#0B0B0C] shadow-lg shadow-[#D4AF37]/25">
            <Sparkles className="size-6 sm:size-7" />
          </div>
          <CardTitle className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {BUSINESS_NAME}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-3 pb-5 sm:pb-6">
          <form onSubmit={submit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="usuario" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Usuario
              </Label>
              <Input
                id="usuario"
                className="h-11 sm:h-12 bg-card/70 text-base"
                autoComplete="username"
                placeholder="Nombre de usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                className="h-11 sm:h-12 bg-card/70 text-base"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="h-11 sm:h-12 w-full text-sm sm:text-base font-bold mt-2"
              loading={login.isPending}
              disabled={login.isPending || !usuario || !password}
            >
              Iniciar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
