import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { ClipboardList, LogOut, ReceiptText, Sparkles, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useLogout } from "@/auth"
import { usePedidosActivos } from "@/lib/queries"
import { cn } from "@/lib/utils"

export const BUSINESS_NAME = "Alex Snacks"

const links = [
  { to: "/", label: "Caja", icon: ReceiptText, end: true },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList, end: false },
  { to: "/resumen", label: "Resumen", icon: TrendingUp, end: false },
]

export default function Layout() {
  const logout = useLogout()
  const navigate = useNavigate()
  const location = useLocation()
  const { data } = usePedidosActivos()
  const activos = data?.length ?? 0

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground select-none">
      {/* Sidebar for Desktop / Wide screens (>= lg) */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border/80 bg-card/60 backdrop-blur-md">
        {/* Brand Header */}
        <div className="flex h-20 items-center gap-3 border-b border-border/60 px-6">
          <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#E6C75A] to-[#B8902A] text-[#0B0B0C] shadow-md shadow-[#D4AF37]/20">
            <Sparkles className="size-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground leading-none">
              {BUSINESS_NAME}
            </h1>
            <span className="text-xs uppercase font-medium tracking-widest text-primary mt-1 inline-block">
              Punto de Venta
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-2 p-4">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "group relative flex h-14 items-center gap-3.5 rounded-xl px-4 text-base font-medium transition-all duration-150 active:scale-[0.98]",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "size-5.5 transition-transform duration-150 group-hover:scale-110",
                      isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="flex-1">{label}</span>
                  {to === "/pedidos" && activos > 0 && (
                    <Badge
                      variant={isActive ? "secondary" : "default"}
                      className={cn(
                        "h-6 px-2.5 font-bold tabular-nums text-xs transition-colors",
                        isActive
                          ? "bg-background/90 text-foreground"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {activos}
                    </Badge>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer: Theme toggle & Logout */}
        <div className="flex items-center justify-between border-t border-border/60 p-4">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label="Cerrar sesión"
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => navigate("/login", { replace: true }),
              })
            }
          >
            <LogOut className="size-5" />
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header for Mobile/Tablet (< lg) */}
        <header className="flex lg:hidden h-16 items-center justify-between border-b border-border/70 bg-card/80 px-4 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#E6C75A] to-[#B8902A] text-[#0B0B0C]">
              <Sparkles className="size-4.5" />
            </div>
            <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">
              {BUSINESS_NAME}
            </h1>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              aria-label="Cerrar sesión"
              onClick={() =>
                logout.mutate(undefined, {
                  onSuccess: () => navigate("/login", { replace: true }),
                })
              }
            >
              <LogOut className="size-5" />
            </Button>
          </div>
        </header>

        {/* Main Viewport */}
        <main
          key={location.pathname}
          className="animate-page-enter min-h-0 flex-1 overflow-auto pb-20 lg:pb-0"
        >
          <Outlet />
        </main>

        {/* Bottom Navigation Bar for Mobile/Tablet (< lg) */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex lg:hidden items-center justify-around border-t border-border/70 bg-card/95 py-2 px-3 backdrop-blur-lg shadow-lg"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
          aria-label="Navegación principal"
        >
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "relative flex min-w-18 flex-col items-center justify-center gap-1 rounded-xl py-1.5 px-3 transition-all duration-150 active:scale-95",
                  isActive
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon className={cn("size-6", isActive && "stroke-[2.5px]")} />
                    {to === "/pedidos" && activos > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground shadow-xs">
                        {activos}
                      </span>
                    )}
                  </div>
                  <span className="text-xs tracking-tight">{label}</span>
                  {isActive && (
                    <span className="absolute -bottom-1 h-1 w-6 rounded-full bg-primary" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
