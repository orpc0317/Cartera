import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  Banknote,
  Bookmark,
  CreditCard,
  FileDigit,
  FileText,
  HandCoins,
  IdCard,
  Landmark,
  Mail,
  MapPin,
  MoreHorizontal,
  MoveHorizontal,
  Receipt,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  LandPlot,
  User,
} from 'lucide-react'

const ICONOS: Record<string, LucideIcon> = {
  IDENTIFICACION: IdCard,
  GENERAL: User,
  DIRECCION: MapPin,
  FACTURACION: Receipt,
  OTROS: MoreHorizontal,
  'OTROS PARAMETROS': SlidersHorizontal,
  REGISTRO: FileText,
  COLINDANCIAS: MoveHorizontal,
  RESERVA: Bookmark,
  MORA: AlertCircle,
  'ABONO CAPITAL': Banknote,
  SERVICIO: Server,
  CERTIFICADO: ShieldCheck,
  CORREO: Mail,
  CONFIGURACION: Settings,
  'DOCUMENTOS ELECTRONICOS': FileDigit,
  LOTE: LandPlot,
  ENGANCHE: HandCoins,
  FINANCIAMIENTO: Landmark,
  'FORMA PAGO': CreditCard,
}

export function SegmentCard({
  label,
  icon,
  children,
  className,
  bodyClassName,
}: {
  label: string
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  const Icono = icon ?? ICONOS[label.trim().toUpperCase()]
  return (
    <div className={cn('col-span-2 grid gap-1.5', className)}>
      <div className="flex shrink-0 items-center gap-2">
        <div className="h-4 w-0.5 rounded-full bg-primary/40" />
        <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-primary" style={{ fontSize: 'var(--ui-section-divider)' }}>
          {Icono ? <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
          {label}
        </span>
      </div>
      <div className={cn('grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-popover p-3', bodyClassName)}>
        {children}
      </div>
    </div>
  )
}
