'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ArrowRight, Home } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { estiloItem, gruposDe, iconoModulo, normalizar, type MenuItem, type MenuModulo } from '@/lib/navigation'

function saludoDe(hora: number): string {
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function itemsVisibles(modulo: MenuModulo, consulta: string): MenuItem[] {
  if (!consulta) return modulo.items
  if (normalizar(modulo.nombre).includes(consulta)) return modulo.items
  return modulo.items.filter((item) =>
    normalizar(`${item.nombre} ${item.descripcion} ${item.grupo}`).includes(consulta),
  )
}

export function HomeClient({
  modulos,
  cuentaNombre,
}: {
  modulos: MenuModulo[]
  cuentaNombre: string
}) {
  const [busqueda, setBusqueda] = useState('')
  const [hashId, setHashId] = useState('')
  const hora = useSyncExternalStore(
    () => () => {},
    () => new Date().getHours(),
    () => -1,
  )
  const saludo = hora < 0 ? 'Hola' : saludoDe(hora)

  useEffect(() => {
    const leer = () => setHashId(window.location.hash.slice(1))
    leer()
    window.addEventListener('hashchange', leer)
    return () => window.removeEventListener('hashchange', leer)
  }, [])

  const consulta = normalizar(busqueda)
  const visibles = useMemo(
    () => modulos
      .map((modulo) => ({ ...modulo, items: itemsVisibles(modulo, consulta) }))
      .filter((modulo) => modulo.items.length > 0),
    [modulos, consulta],
  )
  const activaId = visibles.some((modulo) => modulo.id === hashId)
    ? hashId
    : (visibles[0]?.id ?? '')

  function seleccionarModulo(id: string) {
    const destino = `#${id}`
    if (window.location.hash === destino) return
    window.history.pushState(null, '', destino)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }

  useEffect(() => {
    if (!activaId || !hashId || hashId === activaId) return
    if (visibles.some((modulo) => modulo.id === hashId)) return
    window.history.replaceState(null, '', `#${activaId}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }, [activaId, hashId, visibles])

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Home className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{saludo}</h1>
            <p className="text-sm text-muted-foreground">
              {cuentaNombre ? (
                <>
                  Bienvenido a <span className="font-medium text-foreground">{cuentaNombre}</span>
                  {' '}— elige una funcionalidad
                </>
              ) : (
                'Elige una funcionalidad'
              )}
            </p>
          </div>
        </div>

        <div className="grid w-full max-w-md gap-1">
          <Label
            htmlFor="buscar-funcionalidad"
            className="font-semibold tracking-wider text-muted-foreground"
            style={{ fontSize: 'var(--ui-form-label)' }}
          >
            Buscar funcionalidad
          </Label>
          <Input
            id="buscar-funcionalidad"
            variant="l-border"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Nombre, modulo o grupo"
            autoComplete="off"
          />
        </div>
      </div>

      {modulos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tienes funcionalidades asignadas.</p>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ninguna funcionalidad coincide con la búsqueda.</p>
      ) : (
        <Tabs
          value={activaId}
          onValueChange={(value) => {
            if (typeof value !== 'string' || !value) return
            seleccionarModulo(value)
          }}
          className="gap-6"
        >
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList
              variant="line"
              className="h-auto w-max min-w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0 group-data-horizontal/tabs:h-auto"
            >
              {visibles.map((modulo) => {
                const Icono = iconoModulo(modulo.nombre)
                return (
                  <TabsTrigger
                    key={modulo.id}
                    value={modulo.id}
                    className="h-auto flex-none gap-2 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm after:hidden data-active:border-primary data-active:bg-transparent data-active:text-primary data-active:shadow-none"
                  >
                    <Icono className="h-4 w-4" />
                    {modulo.nombre}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>

          {visibles.map((modulo) => {
            const grupos = gruposDe(modulo.items)
            const mostrarGrupo = grupos.length > 1
            return (
              <TabsContent key={modulo.id} value={modulo.id} id={modulo.id} className="mt-0">
                <div className="flex flex-col gap-6">
                  {grupos.map((grupo) => (
                    <div key={grupo.nombre}>
                      {mostrarGrupo && (
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                          {grupo.nombre}
                        </p>
                      )}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {grupo.items.map((item) => (
                          <TarjetaFuncion key={item.indice} item={item} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </div>
  )
}

function TarjetaFuncion({ item }: { item: MenuItem }) {
  const { icon: Icono, accent } = estiloItem(item.indice)
  const contenido = (
    <Card
      className={cn(
        'h-full border-border/60 shadow-sm',
        item.href && !item.comingSoon
          ? 'transition-all group-hover:-translate-y-0.5 group-hover:shadow-md'
          : 'opacity-60',
      )}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('shrink-0 rounded-xl p-3', accent)}>
          <Icono className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{item.nombre}</p>
          {item.descripcion && (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{item.descripcion}</p>
          )}
        </div>
        {item.comingSoon ? (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Pronto
          </span>
        ) : item.href ? (
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        ) : null}
      </CardContent>
    </Card>
  )

  if (!item.href || item.comingSoon) {
    return <div className="cursor-default">{contenido}</div>
  }

  return (
    <Link href={item.href} className="group">
      {contenido}
    </Link>
  )
}
