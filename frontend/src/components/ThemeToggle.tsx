import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"

const emptySubscribe = () => () => {}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  function toggle() {
    const next = resolvedTheme === "dark" ? "light" : "dark"
    setTheme(next)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-12 w-12 rounded-xl text-foreground/80 hover:text-foreground hover:bg-muted/80 active:scale-95 transition-all ${className ?? ""}`}
      onClick={toggle}
      aria-label={`Cambiar a modo ${mounted && resolvedTheme === "dark" ? "claro" : "oscuro"}`}
      title={mounted ? `Tema actual: ${theme}. Clic para cambiar` : "Cambiar tema"}
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5 text-gold transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="h-5 w-5 text-gold transition-transform duration-200 hover:-rotate-12" />
      )}
      <span className="sr-only">Cambiar tema</span>
    </Button>
  )
}
