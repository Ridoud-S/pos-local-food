import { Navigate, Route, Routes } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useMe } from "@/auth"
import Layout from "@/components/Layout"
import Login from "@/pages/Login"
import Caja from "@/pages/Caja"
import Cuentas from "@/pages/Cuentas"
import Pedidos from "@/pages/Pedidos"
import Resumen from "@/pages/Resumen"
import Usuarios from "@/pages/Usuarios"
import type { Rol } from "@/lib/types"

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoading, isError } = useMe()
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
          <span className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
            Cargando...
          </span>
        </div>
      </div>
    )
  }
  if (isError) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function RequireRole({
  roles = [],
  children,
}: {
  roles?: Rol[]
  children: React.ReactNode
}) {
  const { data: me, isLoading } = useMe()

  if (isLoading) return null
  if (!me) return <Navigate to="/login" replace />

  // Admin siempre pasa
  if (me.rol === "admin" || roles.includes(me.rol)) {
    return <>{children}</>
  }

  // Si el rol no alcanza, redirige a la pantalla de inicio de su rol
  const home = me.rol === "cocina" ? "/pedidos" : "/"
  return <Navigate to={home} replace />
}

function RoleHomeRedirect() {
  const { data: me, isLoading } = useMe()
  if (isLoading) return null
  if (!me) return <Navigate to="/login" replace />
  const home = me.rol === "cocina" ? "/pedidos" : "/"
  return <Navigate to={home} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route
          index
          element={
            <RequireRole roles={["caja"]}>
              <Caja />
            </RequireRole>
          }
        />
        <Route
          path="cuentas"
          element={
            <RequireRole roles={["caja"]}>
              <Cuentas />
            </RequireRole>
          }
        />
        <Route
          path="pedidos"
          element={
            <RequireRole roles={["caja", "cocina"]}>
              <Pedidos />
            </RequireRole>
          }
        />
        <Route
          path="resumen"
          element={
            <RequireRole roles={[]}>
              <Resumen />
            </RequireRole>
          }
        />
        <Route
          path="usuarios"
          element={
            <RequireRole roles={[]}>
              <Usuarios />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<RoleHomeRedirect />} />
    </Routes>
  )
}
