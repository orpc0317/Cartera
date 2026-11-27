function MensajeCampo({
  id,
  campo,
  className,
}: {
  id: string
  campo: { id: string; mensaje?: string } | null
  className?: string
}) {
  if (campo?.id !== id || !campo.mensaje) return null
  return (
    <p id={`${id}-error`} role="alert" className={`text-[11px] leading-tight text-destructive${className ? ` ${className}` : ''}`}>
      {campo.mensaje}
    </p>
  )
}

export { MensajeCampo }
