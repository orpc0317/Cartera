/** Alto de la lista: ocupa el espacio libre del dashboard y no crece con las filas. */
export const LIST_SHELL = 'flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6 md:p-8'

/** Header, toolbar, filtros y contador: quedan fuera del scroll de la tabla. */
export const LIST_BLOCK = 'shrink-0'

/**
 * Unica caja con scroll (horizontal y vertical). El encabezado fijo se ancla aqui.
 * El <Table> de la lista va con scrollable={false} para no crear un segundo overflow.
 */
export const LIST_SCROLLPORT =
  'min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border border-border/60 bg-card shadow-sm outline-none'

/**
 * Mismo tono que bg-muted/30, pero opaco. Un fondo con transparencia deja ver las filas al scrollear.
 */
export const LIST_HEAD_BG = 'bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))]'

export const LIST_THEAD = 'sticky top-0 z-20'

/** Columna de datos, fija arriba. */
export const LIST_HEAD = `sticky top-0 z-20 ${LIST_HEAD_BG}`

/** Columna identificadora, fija arriba y a la izquierda. El ancho (w-20, w-24, ...) va aparte. */
export const LIST_HEAD_LEFT = `sticky left-0 top-0 z-30 ${LIST_HEAD_BG}`

/** Columna de acciones, fija arriba y a la derecha. */
export const LIST_HEAD_RIGHT = `sticky right-0 top-0 z-30 ${LIST_HEAD_BG}`
