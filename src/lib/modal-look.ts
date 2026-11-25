export const FONDO_MODAL = 'bg-[color-mix(in_oklab,var(--muted)_30%,var(--popover))]'
export const FRANJA_BLANCA = 'bg-popover'

export const TEXTO_GRIS_VERDE = 'text-[color-mix(in_oklab,var(--primary)_18%,var(--muted-foreground))]'
export const CLASE_PESTANA_MODAL = [
  'gap-1.5 rounded-md border-b-2 border-b-transparent px-3 py-1 text-sm font-medium',
  'bg-transparent after:hidden',
  TEXTO_GRIS_VERDE,
  'dark:text-[color-mix(in_oklab,var(--primary)_18%,var(--muted-foreground))]',
  'hover:bg-transparent hover:text-primary dark:hover:bg-transparent dark:hover:text-primary',
  'data-active:border-b-primary data-active:bg-transparent data-active:text-primary',
  'data-active:hover:border-b-primary data-active:hover:bg-transparent data-active:hover:text-primary',
  'dark:bg-transparent dark:data-active:border-b-primary dark:data-active:bg-transparent dark:data-active:text-primary',
  'dark:data-active:hover:text-primary',
  'group-data-[variant=line]/tabs-list:bg-transparent',
  'group-data-[variant=line]/tabs-list:data-active:bg-transparent',
  'dark:group-data-[variant=line]/tabs-list:bg-transparent',
  'dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent',
].join(' ')

export const CLASE_PIE_MODAL = 'text-sm font-medium'
export const TEXTO_GRIS_CLARO = 'text-[color-mix(in_srgb,color-mix(in_oklab,var(--primary)_18%,var(--muted-foreground))_50%,var(--popover))]'
export const CLASE_BOTON_MODAL = [
  CLASE_PIE_MODAL,
  TEXTO_GRIS_CLARO,
  'disabled:opacity-100',
  'hover:bg-transparent hover:text-primary',
  'dark:hover:bg-transparent dark:hover:text-primary',
].join(' ')

export const CLASE_BOTON_PELIGRO = [
  CLASE_PIE_MODAL,
  'bg-transparent text-[color-mix(in_oklab,var(--destructive)_40%,var(--muted-foreground))]',
  'hover:bg-transparent hover:text-destructive',
  'dark:hover:bg-transparent',
].join(' ')

export const CLASE_BOTON_CONFIRMAR = 'bg-destructive text-primary-foreground hover:bg-destructive/90'

export const FOCO_LINEA = 'foco-linea'

export const FOCO_SELECT = 'foco-linea'

export const CLASE_SELECT_LINEA = [
  'w-full rounded-none border-0 border-b border-primary/50 bg-transparent px-2 py-0 outline-none disabled:cursor-not-allowed',
  FOCO_LINEA,
].join(' ')
