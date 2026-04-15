'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Pais } from '@/app/actions/geo'

function FlagImg({ code }: { code: string }) {
  return (
    <img
      src={`https://flagcdn.com/w20/${code.toLowerCase()}.png`}
      alt={code}
      width={20}
      height={14}
      className="object-cover rounded-sm shrink-0"
    />
  )
}

interface CountrySelectProps {
  paises: Pais[]
  value: string
  onChange: (codigo: string, nombre: string) => void
  placeholder?: string
  className?: string
}

export function CountrySelect({
  paises,
  value,
  onChange,
  placeholder = 'Seleccionar país',
  className,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = paises.find((p) => p.codigo === value)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {selected ? (
          <span className="flex items-center gap-2"><FlagImg code={selected.codigo} /> {selected.nombre}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-input bg-popover text-popover-foreground shadow-md">
          <div
            className="cursor-pointer px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onMouseDown={(e) => {
              e.preventDefault()
              onChange('', '')
              setOpen(false)
            }}
          >
            {placeholder}
          </div>
          {paises.map((p) => (
            <div
              key={p.codigo}
              className={cn(
                'cursor-pointer px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
                value === p.codigo && 'bg-accent font-medium',
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(p.codigo, p.nombre)
                setOpen(false)
              }}
            >
              <span className="flex items-center gap-2"><FlagImg code={p.codigo} /> {p.nombre}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
