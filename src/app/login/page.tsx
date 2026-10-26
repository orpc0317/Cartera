'use client'

import { memo, useCallback, useEffect, useRef } from 'react'
import { useActionState } from 'react'
import Script from 'next/script'
import { login, setCuentaActiva, type LoginState, type ActionState } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: { sitekey: string; theme: 'auto' },
  ) => string
  remove: (widgetId: string) => void
}

function turnstileApi(): TurnstileApi | undefined {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile
}

const TurnstileWidget = memo(function TurnstileWidget({ siteKey }: { siteKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  const renderWidget = useCallback(() => {
    const container = containerRef.current
    const api = turnstileApi()
    if (!container || !api || widgetIdRef.current) return
    widgetIdRef.current = api.render(container, { sitekey: siteKey, theme: 'auto' })
  }, [siteKey])

  useEffect(() => {
    renderWidget()
    return () => {
      const widgetId = widgetIdRef.current
      if (widgetId) turnstileApi()?.remove(widgetId)
      widgetIdRef.current = null
    }
  }, [renderWidget])

  return (
    <>
      <Script src={TURNSTILE_SRC} strategy="afterInteractive" onReady={renderWidget} />
      <div ref={containerRef} />
    </>
  )
})

export default function LoginPage() {
  const [loginState, loginAction, loginPending] = useActionState<LoginState, FormData>(
    login,
    null
  )
  const [selectState, selectAction, selectPending] = useActionState<ActionState, FormData>(
    setCuentaActiva,
    null
  )

  // Si el login devolvió múltiples cuentas, mostrar selector
  if (loginState?.cuentas) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Seleccionar cuenta</h1>
            <p className="text-sm text-muted-foreground">
              Tu usuario tiene acceso a más de una cuenta. Elige a cuál deseas ingresar.
            </p>
          </div>

          {selectState?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {selectState.error}
            </p>
          )}

          <div className="space-y-2">
            {loginState.cuentas.map((c) => (
              <form key={c.cuenta} action={selectAction}>
                <input type="hidden" name="cuentaId" value={c.cuenta} />
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  type="submit"
                  disabled={selectPending}
                >
                  {c.nombre}
                </Button>
              </form>
            ))}
          </div>
        </div>
      </main>
    )
  }

  // Pantalla de login principal
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Cartera</h1>
            <p className="text-sm text-muted-foreground">Ingresa con tu cuenta</p>
          </div>

          <form action={loginAction} className="space-y-4">
            {loginState?.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {loginState.error}
              </p>
            )}

            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {TURNSTILE_SITE_KEY ? <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} /> : null}

            <Button type="submit" className="w-full" disabled={loginPending}>
              {loginPending ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </div>
      </main>
  )
}
