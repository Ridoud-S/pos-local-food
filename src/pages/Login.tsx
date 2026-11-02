import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLogin, useMe } from "@/auth"

export default function Login() {
    const navigate = useNavigate()
    const me = useMe()
    const login = useLogin()
    const [usuario, setUsuario] = useState("")
    const [password, setPassword] = useState("")

    if (me.data) return <Navigate to="/" replace />

    function submit(e: React.FormEvent) {
        e.preventDefault()
        login.mutate(
            { usuario: usuario.trim(), password },
            {
                onSuccess: () => navigate("/", { replace: true }),
                onError: (err) => toast.error(err.message),
            },
        )
    }

    return (
        <div className="flex h-screen items-center justify-center p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-center text-2xl">Iniciar sesión</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="usuario">Usuario</Label>
                            <Input
                                id="usuario"
                                className="h-12"
                                autoComplete="username"
                                value={usuario}
                                onChange={(e) => setUsuario(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                className="h-12"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <Button
                            type="submit"
                            className="h-12 w-full text-base"
                            disabled={login.isPending || !usuario || !password}
                        >
                            {login.isPending ? "Entrando..." : "Entrar"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}