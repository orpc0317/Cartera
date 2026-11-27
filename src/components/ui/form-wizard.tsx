'use client'

import { useState, type ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, MapPin, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type WizardStep = {
  id: string
  label: string
  icon?: LucideIcon
}

export const PASOS_GENERAL: readonly WizardStep[] = [
  { id: 'general', label: 'General', icon: MapPin },
]

export function useWizardNav(
  steps: readonly WizardStep[],
  activeId: string,
  onChange: (id: string) => void,
  activo: boolean,
) {
  const indiceEncontrado = steps.findIndex((step) => step.id === activeId)
  const indice = indiceEncontrado >= 0 ? indiceEncontrado : 0
  const [maxIndice, setMaxIndice] = useState(0)
  const [seguimiento, setSeguimiento] = useState({ activo, indice })
  if (seguimiento.activo !== activo || seguimiento.indice !== indice) {
    setSeguimiento({ activo, indice })
    if (!activo) setMaxIndice(0)
    else setMaxIndice((prev) => Math.max(prev, indice))
  }

  function anterior() {
    if (indice > 0) onChange(steps[indice - 1].id)
  }

  function siguiente() {
    if (indice < steps.length - 1) onChange(steps[indice + 1].id)
  }

  function reiniciar() {
    setMaxIndice(0)
    const primero = steps[0]
    if (primero) onChange(primero.id)
  }

  return {
    indice,
    esPrimero: indice <= 0,
    esUltimo: indice >= steps.length - 1,
    maxIndice,
    anterior,
    siguiente,
    reiniciar,
  }
}

export function FormWizard({
  steps,
  value,
  onValueChange,
  maxIndice,
  className,
  contenidoClassName,
  navClassName,
  pasoClassName,
  children,
}: {
  steps: readonly WizardStep[]
  value: string
  onValueChange: (id: string) => void
  maxIndice: number
  className?: string
  contenidoClassName?: string
  navClassName?: string
  pasoClassName?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <nav aria-label="Pasos del formulario" className={cn('shrink-0 pb-2', navClassName)}>
        <ol className="flex flex-wrap items-center gap-1">
          {steps.map((step, i) => {
            const actual = step.id === value
            const futuro = i > maxIndice
            const Icon = step.icon
            return (
              <li
                key={step.id}
                aria-label={step.label}
                aria-current={actual ? 'step' : undefined}
                className="flex items-center gap-1"
              >
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" aria-hidden />}
                <button
                  type="button"
                  disabled={futuro}
                  onClick={() => { if (!futuro) onValueChange(step.id) }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors',
                    actual && 'bg-primary/10 font-medium text-primary',
                    !actual && !futuro && 'text-foreground hover:bg-muted',
                    futuro && 'cursor-not-allowed text-muted-foreground/50',
                    pasoClassName,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold',
                      actual ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {i + 1}
                  </span>
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {step.label}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      <div className={cn('mt-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-1', contenidoClassName)}>
        {children}
      </div>
    </div>
  )
}

export function WizardAltaActions({
  nav,
  onSave,
  pending,
  pendingLabel,
  saveLabel = 'Guardar',
  className,
  siguienteDeshabilitado = false,
  leading,
}: {
  nav: { esPrimero: boolean; esUltimo: boolean; anterior: () => void; siguiente: () => void }
  onSave: () => void
  pending: boolean
  pendingLabel: string
  saveLabel?: string
  className?: string
  siguienteDeshabilitado?: boolean
  leading?: ReactNode
}) {
  return (
    <div className="flex w-full justify-end gap-2">
      {leading}
      {!nav.esPrimero && (
        <Button type="button" variant="ghost" size="sm" className={className} onClick={nav.anterior} disabled={pending}>
          <ChevronLeft className="mr-1.5 h-3.5 w-3.5" /> Anterior
        </Button>
      )}
      {nav.esUltimo ? (
        <Button type="button" variant="ghost" size="sm" className={className} onClick={onSave} disabled={pending}>
          <Check className="mr-1.5 h-3.5 w-3.5" /> {pending ? pendingLabel : saveLabel}
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" className={className} onClick={nav.siguiente} disabled={pending || siguienteDeshabilitado}>
          Siguiente <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
