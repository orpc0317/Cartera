'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type EstadoLectura = {
  clave: string | null
  pendiente: boolean
  fallo: boolean
}

export function useFilas<T>(inicial: T[]) {
  const [filas, setFilas] = useState(inicial)
  useEffect(() => { setFilas(inicial) }, [inicial])
  return [filas, setFilas] as const
}

export function useRegistroVer<T>(opts: {
  activo: boolean
  clave: string | null
  editando: boolean
  leer: () => Promise<{ row?: T; error?: string }>
  alLlegar: (row: T, editando: boolean) => void
}) {
  const claveActiva = opts.activo && opts.clave ? opts.clave : null
  const [estado, setEstado] = useState<EstadoLectura>({ clave: null, pendiente: false, fallo: false })
  if (estado.clave !== claveActiva) {
    setEstado({ clave: claveActiva, pendiente: claveActiva != null, fallo: false })
  }

  const editandoRef = useRef(opts.editando)
  editandoRef.current = opts.editando
  const leerRef = useRef(opts.leer)
  leerRef.current = opts.leer
  const alLlegarRef = useRef(opts.alLlegar)
  alLlegarRef.current = opts.alLlegar

  useEffect(() => {
    if (!claveActiva) return
    let cancelado = false
    leerRef.current()
      .then((result) => {
        if (cancelado) return
        if (result.error || !result.row) {
          toast.error(result.error ?? 'No se pudo leer el registro.')
          setEstado((prev) => prev.clave === claveActiva ? { ...prev, pendiente: false, fallo: true } : prev)
          return
        }
        alLlegarRef.current(result.row, editandoRef.current)
        setEstado((prev) => prev.clave === claveActiva ? { ...prev, pendiente: false, fallo: false } : prev)
      })
      .catch(() => {
        if (cancelado) return
        toast.error('No se pudo leer el registro.')
        setEstado((prev) => prev.clave === claveActiva ? { ...prev, pendiente: false, fallo: true } : prev)
      })
    return () => { cancelado = true }
  }, [claveActiva])

  return { lecturaPendiente: estado.pendiente || estado.fallo }
}
