'use client'

import { useState, useEffect, useTransition } from 'react'
import { History, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { getAuditLog, type AuditEntry } from '@/app/actions/audit'

// Campos a excluir del diff (metadatos internos)
const SKIP_FIELDS = new Set([
  'cuenta', 'codigo', 'agrego_usuario', 'agrego_fecha', 'modifico_usuario', 'modifico_fecha',
])

// Etiquetas legibles por campo
const FIELD_LABELS: Record<string, string> = {
  nombre:                        'Nombre',
  razon_social:                  'Razón Social',
  identificacion_tributaria:      'ID Tributaria',
  regimen_isr:                   'Régimen ISR',
  direccion:                     'Dirección',
  pais:                          'País',
  departamento:                  'Departamento',
  municipio:                     'Municipio',
  codigo_postal:                 'Código Postal',
  empresa:                       'Empresa',
  proyecto:                      'Proyecto',
  fase:                          'Fase',
  manzana:                       'Manzana',
  telefono1:                     'Teléfono 1',
  telefono2:                     'Teléfono 2',
  mora_automatica:               'Mora automática',
  fijar_parametros_mora:         'Fijar parámetros mora',
  forma_mora:                    'Forma de mora',
  interes_mora:                  'Interés de mora',
  fijo_mora:                     'Mora fija',
  mora_enganche:                 'Mora sobre enganche',
  dias_gracia:                   'Días de gracia',
  dias_afectos:                  'Días afectos',
  inicio_calculo_mora:           'Inicio cálculo mora',
  calcular_mora_antes:           'Calcular mora antes',
  minimo_mora:                   'Mora mínima',
  minimo_abono_capital:          'Mínimo abono capital',
  inicio_abono_capital_estricto: 'Inicio abono cap. estricto',
  promesa_vencida:               'Promesa vencida',
  medida:                        'Medida',
  moneda:                        'Moneda',
  valor:                         'Valor',
  extension:                     'Extensión',
  finca:                         'Finca',
  folio:                         'Folio',
  libro:                         'Libro',
  norte:                         'Norte (colindancia)',
  sur:                           'Sur (colindancia)',
  este:                          'Este (colindancia)',
  oeste:                         'Oeste (colindancia)',
  otro:                          'Otras colindancias',
}

function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key
}

const FMT = new Intl.DateTimeFormat('es-GT', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  timeZone: typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
  timeZoneName: 'short',
})

function ChangedFields({ antes, despues }: {
  antes: Record<string, unknown> | null
  despues: Record<string, unknown> | null
}) {
  if (!antes || !despues) return null

  const changed = Object.keys(despues).filter(
    (k) => !SKIP_FIELDS.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(despues[k]),
  )

  if (changed.length === 0) {
    return <span className="text-xs text-muted-foreground italic">Sin cambios en campos visibles</span>
  }

  return (
    <div className="mt-1.5 space-y-1">
      {changed.map((k) => (
        <div key={k} className="text-xs">
          <span className="font-medium text-foreground">{fieldLabel(k)}:</span>{' '}
          <span className="text-muted-foreground line-through">{String(antes[k] ?? '—')}</span>
          {' → '}
          <span className="text-foreground font-medium">{String(despues[k] ?? '—')}</span>
        </div>
      ))}
    </div>
  )
}

const OP_CONFIG = {
  INSERT: { label: 'Creado',     variant: 'default'     as const },
  UPDATE: { label: 'Modificado', variant: 'secondary'   as const },
  DELETE: { label: 'Eliminado',  variant: 'destructive' as const },
}

interface AuditLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabla: string
  cuenta: string
  codigo: number | string
  titulo: string
}

export function AuditLogDialog({ open, onOpenChange, tabla, cuenta, codigo, titulo }: AuditLogDialogProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    startTransition(async () => {
      const data = await getAuditLog(tabla, cuenta, codigo)
      setEntries(data)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial — {titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-1">
          {isPending ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Cargando historial…
            </div>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay registros de auditoría.
            </p>
          ) : (
            <ol className="relative border-l border-border ml-3">
              {entries.map((e) => {
                const cfg = OP_CONFIG[e.operacion]
                return (
                  <li key={e.id} className="mb-6 ml-4">
                    <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-background bg-border" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                      <time className="text-xs text-muted-foreground">
                        {FMT.format(new Date(e.fecha))}
                      </time>
                      {(e.usuario_nombre || e.usuario_email) && (
                        <span className="text-xs text-muted-foreground">
                          — {e.usuario_nombre || e.usuario_email}
                        </span>
                      )}
                    </div>
                    {e.operacion === 'UPDATE' && (
                      <ChangedFields antes={e.datos_antes} despues={e.datos_despues} />
                    )}
                    {e.operacion === 'INSERT' && (
                      <p className="mt-1 text-xs text-muted-foreground">Registro creado.</p>
                    )}
                    {e.operacion === 'DELETE' && (
                      <p className="mt-1 text-xs text-destructive">Registro eliminado.</p>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
