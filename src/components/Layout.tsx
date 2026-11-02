import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { ClipboardList, LogOut, ReceiptText, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLogout } from "@/auth"
import { usePorCobrar } from "@/lib/queries"
import { cn } from "@/lib/utils"

const links = [
    { to: "/", label: "Caja", icon: ReceiptText, end: true },
    { to: "/pedidos", label: "Pedidos", icon: ClipboardList, end: false },
    { to: "/resumen", label: "Resumen", icon: TrendingUp, end: false },
]

export default function Layout() {
    const logout = useLogout()
    const navigate = useNavigate()
    const { data } = usePorCobrar()
    const pendientes = data?.length ?? 0

    return (
        <div className="flex h-screen flex-col">
            <header className="flex items-center justify-between border-b px-3 py-2">
                <nav className="flex gap-1">
                    {links.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                cn(
                                    "flex h-12 items-center gap-2 rounded-md px-4 text-sm font-medium",
                                    isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                                )
                            }
                        >
                            <Icon className="h-5 w-5" />
                            {label}
                            {to === "/pedidos" && pendientes > 0 && (
                                <Badge variant="secondary">{pendientes}</Badge>
                            )}
                        </NavLink>
                    ))}
                </nav>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12"
                    aria-label="Cerrar sesión"
                    onClick={() =>
                        logout.mutate(undefined, { onSuccess: () => navigate("/login", { replace: true }) })
                    }
                >
                    <LogOut className="h-5 w-5" />
                </Button>
            </header>
            <main className="min-h-0 flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    )
}
