'use client'

import { useEffect } from 'react'

/**
 * Escucha el BroadcastChannel 'cartera-cuenta'.
 * Cuando otra pestaña cambia de cuenta activa, redirige esta pestaña al home
 * para evitar que quede mostrando datos de la cuenta anterior.
 */
export function CuentaChangeListener() {
  useEffect(() => {
    const channel = new BroadcastChannel('cartera-cuenta')

    const handleMessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'cuenta-changed') {
        window.location.href = '/dashboard/home'
      }
    }

    channel.addEventListener('message', handleMessage)
    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }, [])

  return null
}
