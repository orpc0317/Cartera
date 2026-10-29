'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export type CampoInvalido = { id: string; tab: string }

export function enfocarCampoInvalido(id: string) {
  const el = document.getElementById(id)
  if (!(el instanceof HTMLElement)) return
  el.scrollIntoView({ block: 'nearest' })
  el.focus({ preventScroll: true })
}

export function useCampoInvalido(tabInicial = 'general') {
  const [activeTab, setActiveTab] = useState(tabInicial)
  const [campoInvalido, setCampoInvalido] = useState<CampoInvalido | null>(null)

  useEffect(() => {
    if (!campoInvalido) return
    enfocarCampoInvalido(campoInvalido.id)
  }, [campoInvalido, activeTab])

  function rechazar(id: string, message: string, tab = tabInicial) {
    setCampoInvalido({ id, tab })
    setActiveTab(tab)
    toast.error(message)
  }

  function limpiarCampoInvalido() {
    setCampoInvalido(null)
  }

  return { activeTab, setActiveTab, campoInvalido, rechazar, limpiarCampoInvalido }
}
