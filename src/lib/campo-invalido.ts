export type CampoInvalido = { id: string; tab: string }

export function enfocarCampoInvalido(id: string) {
  const el = document.getElementById(id)
  if (!(el instanceof HTMLElement)) return
  el.scrollIntoView({ block: 'nearest' })
  el.focus({ preventScroll: true })
}
