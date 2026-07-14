'use client'

import { Fragment, useEffect, useMemo, useState, useTransition } from 'react'
import { Download, Loader2, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableFooter,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { getPlanPago } from '@/app/actions/plan-pago'
import type { Promesa } from '@/lib/types/promesas'
import type { PlanPagoCuota, PlanOtroCuota, PlanOtroColumna } from '@/lib/types/plan-pago'

// ─── Helpers ───────────────────────────────────────────────────────────────

const fmtDate = (d: string | null | undefined) => {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const fmtNum = (n: number) => (n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ESTADO_CUOTA: Record<number, { label: string; className: string }> = {
  0: { label: 'Corriente', className: 'border-blue-500 text-blue-700 dark:text-blue-400' },
  1: { label: 'Atrasada',  className: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400' },
  2: { label: 'Pagada',    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400' },
  3: { label: 'Pendiente', className: 'border-border text-muted-foreground' },
}

function formatCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  return str.includes(',') || str.includes('\n') || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

type Row = PlanPagoCuota & {
  otrosForRow: { monto: number; monto_pagado: number }[]
  cuotaMonto: number
  cuotaPagado: number
  saldo: number
}

function buildRow(c: PlanPagoCuota, otros: PlanOtroCuota[], otrosColumnas: PlanOtroColumna[]): Row {
  const otrosForRow = otrosColumnas.map((col) => {
    const found = otros.find((o) => o.tipo_cuota === c.tipo_cuota && o.cuota === c.cuota && o.tipo_otros === col.codigo)
    return { monto: found?.monto ?? 0, monto_pagado: found?.monto_pagado ?? 0 }
  })
  const otrosMonto   = otrosForRow.reduce((s, o) => s + o.monto, 0)
  const otrosPagado  = otrosForRow.reduce((s, o) => s + o.monto_pagado, 0)
  const cuotaMonto   = c.capital + c.interes + otrosMonto + c.mora
  const cuotaPagado  = c.capital_pagado + c.interes_pagado + otrosPagado + c.mora_pagado
  return { ...c, otrosForRow, cuotaMonto, cuotaPagado, saldo: cuotaMonto - cuotaPagado }
}

type Totales = {
  capital: number; capital_pagado: number
  interes: number; interes_pagado: number
  mora: number; mora_pagado: number
  cuotaMonto: number; cuotaPagado: number
  otros: { monto: number; monto_pagado: number }[]
}

function sumRows(rows: Row[], otrosColumnas: PlanOtroColumna[]): Totales {
  const t: Totales = {
    capital: 0, capital_pagado: 0, interes: 0, interes_pagado: 0,
    mora: 0, mora_pagado: 0, cuotaMonto: 0, cuotaPagado: 0,
    otros: otrosColumnas.map(() => ({ monto: 0, monto_pagado: 0 })),
  }
  for (const r of rows) {
    t.capital += r.capital; t.capital_pagado += r.capital_pagado
    t.interes += r.interes; t.interes_pagado += r.interes_pagado
    t.mora += r.mora; t.mora_pagado += r.mora_pagado
    t.cuotaMonto += r.cuotaMonto; t.cuotaPagado += r.cuotaPagado
    r.otrosForRow.forEach((o, i) => { t.otros[i].monto += o.monto; t.otros[i].monto_pagado += o.monto_pagado })
  }
  return t
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground truncate">{value || '\u2014'}</span>
    </div>
  )
}

function exportPlanPagoCsv(
  enganche: Row[], financiamiento: Row[], otrosColumnas: PlanOtroColumna[], numero: number,
) {
  const headers = [
    'Seccion', 'Cuota', 'Fecha',
    'Capital Monto', 'Capital Pagado',
    'Intereses Monto', 'Intereses Pagado',
    ...otrosColumnas.flatMap((c) => [`${c.etiqueta} Monto`, `${c.etiqueta} Pagado`]),
    'Mora Monto', 'Mora Pagado',
    'Cuota Monto', 'Cuota Pagado',
    'Saldo', 'Estado',
  ]
  const rowsToCsv = (seccion: string, rows: Row[]) => rows.map((r) => [
    seccion, r.cuota, fmtDate(r.fecha),
    r.capital.toFixed(2), r.capital_pagado.toFixed(2),
    r.interes.toFixed(2), r.interes_pagado.toFixed(2),
    ...r.otrosForRow.flatMap((o) => [o.monto.toFixed(2), o.monto_pagado.toFixed(2)]),
    r.mora.toFixed(2), r.mora_pagado.toFixed(2),
    r.cuotaMonto.toFixed(2), r.cuotaPagado.toFixed(2),
    r.saldo.toFixed(2), ESTADO_CUOTA[r.estado]?.label ?? String(r.estado),
  ].map(formatCsvCell).join(','))

  const lines = [
    headers.join(','),
    ...rowsToCsv('Enganche', enganche),
    ...rowsToCsv('Financiamiento', financiamiento),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `plan-pagos-${numero}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Componente ─────────────────────────────────────────────────────────────

interface PlanPagoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promesa: Promesa
  empresaNombre?: string
  proyectoNombre?: string
  clienteNombre?: string
  faseNombre?: string
}

export function PlanPagoDialog({
  open, onOpenChange, promesa, empresaNombre, proyectoNombre, clienteNombre, faseNombre,
}: PlanPagoDialogProps) {
  const [loading, startTransition]      = useTransition()
  const [cuotas, setCuotas]             = useState<PlanPagoCuota[]>([])
  const [otros, setOtros]               = useState<PlanOtroCuota[]>([])
  const [otrosColumnas, setOtrosColumnas] = useState<PlanOtroColumna[]>([])

  useEffect(() => {
    if (!open) return
    startTransition(async () => {
      const data = await getPlanPago(promesa.empresa, promesa.proyecto, promesa.numero)
      setCuotas(data.cuotas)
      setOtros(data.otros)
      setOtrosColumnas(data.otrosColumnas)
    })
  }, [open, promesa.empresa, promesa.proyecto, promesa.numero, startTransition])

  const engancheRows = useMemo(
    () => cuotas.filter((c) => c.tipo_cuota === 1).map((c) => buildRow(c, otros, otrosColumnas)),
    [cuotas, otros, otrosColumnas],
  )
  const financiamientoRows = useMemo(
    () => cuotas.filter((c) => c.tipo_cuota === 2).map((c) => buildRow(c, otros, otrosColumnas)),
    [cuotas, otros, otrosColumnas],
  )

  const totalEnganche       = useMemo(() => sumRows(engancheRows, otrosColumnas), [engancheRows, otrosColumnas])
  const totalFinanciamiento = useMemo(() => sumRows(financiamientoRows, otrosColumnas), [financiamientoRows, otrosColumnas])
  const totalGeneral        = useMemo(
    () => sumRows([...engancheRows, ...financiamientoRows], otrosColumnas),
    [engancheRows, financiamientoRows, otrosColumnas],
  )

  const moraEsFijo = (promesa.fijo_mora ?? 0) > 0

  const colSpanTotal = 2 /* Cuota, Fecha */ + 8 /* Capital, Interes, Mora, Cuota x2 */ + 2 /* Saldo, Estado */ + otrosColumnas.length * 2

  function renderGroupHeaderRow() {
    return (
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableHead rowSpan={2} className="w-14 align-bottom">Cuota</TableHead>
        <TableHead rowSpan={2} className="whitespace-nowrap align-bottom">Fecha</TableHead>
        <TableHead colSpan={2} className="text-center border-l border-border/50">Capital</TableHead>
        <TableHead colSpan={2} className="text-center border-l border-border/50">Intereses</TableHead>
        {otrosColumnas.map((c) => (
          <TableHead key={c.codigo} colSpan={2} className="text-center border-l border-border/50">{c.etiqueta}</TableHead>
        ))}
        <TableHead colSpan={2} className="text-center border-l border-border/50">Mora</TableHead>
        <TableHead colSpan={2} className="text-center border-l border-border/50">Cuota</TableHead>
        <TableHead rowSpan={2} className="text-right border-l border-border/50 align-bottom">Saldo</TableHead>
        <TableHead rowSpan={2} className="text-center align-bottom">Estado</TableHead>
      </TableRow>
    )
  }

  function renderSubHeaderRow() {
    return (
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableHead className="text-right text-xs border-l border-border/50">Monto</TableHead>
        <TableHead className="text-right text-xs">Pagado</TableHead>
        <TableHead className="text-right text-xs border-l border-border/50">Monto</TableHead>
        <TableHead className="text-right text-xs">Pagado</TableHead>
        {otrosColumnas.map((c) => (
          <Fragment key={c.codigo}>
            <TableHead className="text-right text-xs border-l border-border/50">Monto</TableHead>
            <TableHead className="text-right text-xs">Pagado</TableHead>
          </Fragment>
        ))}
        <TableHead className="text-right text-xs border-l border-border/50">Monto</TableHead>
        <TableHead className="text-right text-xs">Pagado</TableHead>
        <TableHead className="text-right text-xs border-l border-border/50">Monto</TableHead>
        <TableHead className="text-right text-xs">Pagado</TableHead>
      </TableRow>
    )
  }

  function renderRow(r: Row) {
    const estado = ESTADO_CUOTA[r.estado] ?? { label: `#${r.estado}`, className: '' }
    return (
      <TableRow key={`${r.tipo_cuota}-${r.cuota}`}>
        <TableCell className="font-mono text-xs text-muted-foreground">{r.cuota}</TableCell>
        <TableCell className="whitespace-nowrap tabular-nums">{fmtDate(r.fecha)}</TableCell>
        <TableCell className="text-right tabular-nums border-l border-border/50">{fmtNum(r.capital)}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{fmtNum(r.capital_pagado)}</TableCell>
        <TableCell className="text-right tabular-nums border-l border-border/50">{fmtNum(r.interes)}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{fmtNum(r.interes_pagado)}</TableCell>
        {r.otrosForRow.map((o, i) => (
          <Fragment key={otrosColumnas[i].codigo}>
            <TableCell className="text-right tabular-nums border-l border-border/50">{fmtNum(o.monto)}</TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">{fmtNum(o.monto_pagado)}</TableCell>
          </Fragment>
        ))}
        <TableCell className="text-right tabular-nums border-l border-border/50">{fmtNum(r.mora)}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{fmtNum(r.mora_pagado)}</TableCell>
        <TableCell className="text-right tabular-nums font-medium border-l border-border/50">{fmtNum(r.cuotaMonto)}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{fmtNum(r.cuotaPagado)}</TableCell>
        <TableCell className="text-right tabular-nums font-medium border-l border-border/50">{fmtNum(r.saldo)}</TableCell>
        <TableCell className="text-center">
          <Badge variant="outline" className={estado.className}>{estado.label}</Badge>
        </TableCell>
      </TableRow>
    )
  }

  function renderTotalRow(label: string, t: Totales, className?: string) {
    return (
      <TableRow className={className}>
        <TableCell colSpan={2} className="font-semibold">{label}</TableCell>
        <TableCell className="text-right tabular-nums font-semibold border-l border-border/50">{fmtNum(t.capital)}</TableCell>
        <TableCell className="text-right tabular-nums font-semibold text-muted-foreground">{fmtNum(t.capital_pagado)}</TableCell>
        <TableCell className="text-right tabular-nums font-semibold border-l border-border/50">{fmtNum(t.interes)}</TableCell>
        <TableCell className="text-right tabular-nums font-semibold text-muted-foreground">{fmtNum(t.interes_pagado)}</TableCell>
        {t.otros.map((o, i) => (
          <Fragment key={otrosColumnas[i].codigo}>
            <TableCell className="text-right tabular-nums font-semibold border-l border-border/50">{fmtNum(o.monto)}</TableCell>
            <TableCell className="text-right tabular-nums font-semibold text-muted-foreground">{fmtNum(o.monto_pagado)}</TableCell>
          </Fragment>
        ))}
        <TableCell className="text-right tabular-nums font-semibold border-l border-border/50">{fmtNum(t.mora)}</TableCell>
        <TableCell className="text-right tabular-nums font-semibold text-muted-foreground">{fmtNum(t.mora_pagado)}</TableCell>
        <TableCell className="text-right tabular-nums font-semibold border-l border-border/50">{fmtNum(t.cuotaMonto)}</TableCell>
        <TableCell className="text-right tabular-nums font-semibold text-muted-foreground">{fmtNum(t.cuotaPagado)}</TableCell>
        <TableCell className="text-right tabular-nums font-semibold border-l border-border/50">{fmtNum(t.cuotaMonto - t.cuotaPagado)}</TableCell>
        <TableCell />
      </TableRow>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col w-[95vw] sm:max-w-[80rem] h-[750px] max-h-[90vh] overflow-hidden">
        <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-2 bg-gradient-to-br from-fuchsia-50/70 to-transparent border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3 pr-8">
            <div className="shrink-0 rounded-xl p-2 bg-fuchsia-100 text-fuchsia-700"><Receipt className="h-5 w-5" /></div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold leading-tight truncate">
                Plan de Pagos &mdash; Promesa {promesa.numero}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {[empresaNombre, proyectoNombre].filter(Boolean).join(' \u00b7 ')}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4 pt-2">
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 shrink-0">
            <InfoField label="Cliente"        value={clienteNombre ?? ''} />
            <InfoField label="Lote"           value={`${faseNombre ?? ''} Mnz. ${promesa.manzana} Lote ${promesa.lote}`.trim()} />
            <InfoField label="Fecha Promesa"  value={fmtDate(promesa.fecha)} />
            <InfoField label="Valor Lote"     value={`${promesa.moneda} ${fmtNum(promesa.valor_lote)}`} />
            <InfoField label="Subsidio"       value={`${promesa.moneda} ${fmtNum(promesa.subsidio)}`} />
            <InfoField label="Arras"          value={`${promesa.moneda} ${fmtNum(promesa.arras)}`} />
            <InfoField label="Enganche"       value={`${promesa.moneda} ${fmtNum(promesa.monto_enganche)} \u00b7 ${promesa.plazo_enganche} cuota(s)`} />
            <InfoField label="Financiamiento" value={`${promesa.moneda} ${fmtNum(promesa.monto_financiamiento)} \u00b7 ${promesa.plazo_financiamiento} cuota(s)`} />
            <InfoField label="Interes Anual"  value={`${fmtNum(promesa.interes_anual)}%`} />
            <InfoField
              label="Mora"
              value={moraEsFijo
                ? `${promesa.moneda} ${fmtNum(promesa.fijo_mora)} fijo`
                : `${fmtNum(promesa.interes_mora)}% ${promesa.forma_mora === 1 ? 'diario' : 'mensual'}`}
            />
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : cuotas.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">{'Esta promesa todav\u00eda no tiene un Plan de Pagos generado.'}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-x-auto">
              <Table>
                <TableHeader>
                  {renderGroupHeaderRow()}
                  {renderSubHeaderRow()}
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-fuchsia-50/50 dark:bg-fuchsia-950/20 hover:bg-fuchsia-50/50">
                    <TableCell colSpan={colSpanTotal} className="font-semibold text-fuchsia-700 dark:text-fuchsia-400 text-xs uppercase tracking-wider">
                      Enganche
                    </TableCell>
                  </TableRow>
                  {engancheRows.length === 0 ? (
                    <TableRow><TableCell colSpan={colSpanTotal} className="text-center text-muted-foreground py-4">Sin cuotas de enganche</TableCell></TableRow>
                  ) : engancheRows.map(renderRow)}
                  {renderTotalRow('Total Enganche', totalEnganche, 'bg-muted/20 hover:bg-muted/20')}

                  <TableRow className="bg-fuchsia-50/50 dark:bg-fuchsia-950/20 hover:bg-fuchsia-50/50">
                    <TableCell colSpan={colSpanTotal} className="font-semibold text-fuchsia-700 dark:text-fuchsia-400 text-xs uppercase tracking-wider">
                      Financiamiento
                    </TableCell>
                  </TableRow>
                  {financiamientoRows.length === 0 ? (
                    <TableRow><TableCell colSpan={colSpanTotal} className="text-center text-muted-foreground py-4">Sin cuotas de financiamiento</TableCell></TableRow>
                  ) : financiamientoRows.map(renderRow)}
                  {renderTotalRow('Total Financiamiento', totalFinanciamiento, 'bg-muted/20 hover:bg-muted/20')}
                </TableBody>
                <TableFooter>
                  {renderTotalRow('TOTALES', totalGeneral)}
                </TableFooter>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="-mx-4 -mb-4 px-5 py-3 bg-muted/30 border-t border-border/50 shrink-0">
          <div className="flex w-full items-center justify-between">
            <Button
              variant="outline" size="sm"
              disabled={loading || cuotas.length === 0}
              onClick={() => exportPlanPagoCsv(engancheRows, financiamientoRows, otrosColumnas, promesa.numero)}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
