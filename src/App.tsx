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
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
