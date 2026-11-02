import { Navigate, Route, Routes } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useMe } from "@/auth"
import Layout from "@/components/Layout"
import Login from "@/pages/Login"
import Caja from "@/pages/Caja"
import Pedidos from "@/pages/Pedidos"
import Resumen from "@/pages/Resumen"

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
        <Route index element={<Caja />} />
        <Route path="pedidos" element={<Pedidos />} />
        <Route path="resumen" element={<Resumen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
