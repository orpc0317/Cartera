'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CircleDollarSign, Search, Trash2, Plus, AlertCircle, Loader2,
} from 'lucide-react'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { getReciboParaDeposito, depositarPagos } from '@/app/actions/depositar-pagos'
import type { Empresa, Proyecto, Banco, CuentaBancaria, SerieRecibo } from '@/lib/types/proyectos'
import type { ReciboDetalleItem } from '@/lib/types/depositar-pagos'

// ─── Constantes ───────────────────────────────────────────────────────────

const FORMAS_PAGO: Record<number, string> = {
  1: 'Efectivo',
  2: 'Cheque',
  3: 'Deposito',
  4: 'Transferencia'
}

const fmt = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmtDate(d: string): string {
  if (!d) return ''
  const parts = d.split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

// ─── Primitivos de UI ─────────────────────────────────────────────────────

function ViewField({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="grid gap-1">
      <span className="font-semibold tracking-wider leading-none text-muted-foreground" style={{ fontSize: 'var(--ui-viewfield-label)' }}>{label}</span>
      <div className="flex items-center rounded-none bg-transparent border-0 border-b border-primary/50 px-2" style={{ height: 'var(--ui-field-height)' }}>
        <span className="block font-medium text-foreground" style={{ fontSize: 'var(--ui-viewfield-value)' }}>{value ?? ''}</span>
      </div>
    </div>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-2 flex items-center gap-2 pt-1">
      <div className="h-4 w-0.5 rounded-full bg-primary/40" />
      <span className="font-semibold uppercase tracking-wider text-primary" style={{ fontSize: 'var(--ui-section-divider)' }}>{label}</span>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────

type Props = {
  empresas:         Empresa[]
  proyectos:        Proyecto[]
  cuentasBancarias: CuentaBancaria[]
  seriesRecibo:     SerieRecibo[]
  bancos:           Banco[]
  puedeAgregar:     boolean
}

// ─── Componente ───────────────────────────────────────────────────────────

export function DepositarPagosClient({
  empresas,
  proyectos,
  cuentasBancarias,
  seriesRecibo,
  bancos,
  puedeAgregar,
}: Props) {
  const router = useRouter()

  // ── Encabezado ──
  const [empresa,          setEmpresa]          = useState<number>(0)
  const [proyecto,         setProyecto]         = useState<number>(0)
  const [cuentaBancaria,   setCuentaBancaria]   = useState<number>(0)
  const [fecha,            setFecha]            = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [numeroDocumento,  setNumeroDocumento]  = useState<string>('')

  // ── Detalle ──
  const [recibos,       setRecibos]       = useState<ReciboDetalleItem[]>([])
  const [buscarSerie,   setBuscarSerie]   = useState<string>('')
  const [buscarNumero,  setBuscarNumero]  = useState<string>('')
  const [reciboPreview, setReciboPreview] = useState<ReciboDetalleItem | null>(null)
  const [buscarError,   setBuscarError]   = useState<string>('')

  // ── Transiciones ──
  const [isPendingBuscar, startTransitionBuscar] = useTransition()
  const [isPendingSave,   startTransitionSave]   = useTransition()

  // ── Inicialización en mount ──
  useEffect(() => {
    const firstEmpresa  = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.filter((p) => p.empresa === firstEmpresa)[0]?.codigo ?? 0
    const firstCuenta   = cuentasBancarias.filter((c) => c.empresa === firstEmpresa && c.proyecto === firstProyecto)[0]?.codigo ?? 0
    const firstSerie    = seriesRecibo.filter((s) => s.empresa === firstEmpresa && s.proyecto === firstProyecto && s.activo === 1)[0]?.serie ?? ''
    setEmpresa(firstEmpresa)
    setProyecto(firstProyecto)
    setCuentaBancaria(firstCuenta)
    setBuscarSerie(firstSerie)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Valores derivados ──
  const proyectosFiltrados       = useMemo(() => proyectos.filter((p) => p.empresa === empresa), [proyectos, empresa])
  const cuentasBancariasFiltradas = useMemo(() => cuentasBancarias.filter((c) => c.activo === 1 && c.empresa === empresa && c.proyecto === proyecto), [cuentasBancarias, empresa, proyecto])
  const seriesFiltradas          = useMemo(() => seriesRecibo.filter((s) => s.empresa === empresa && s.proyecto === proyecto && s.activo === 1), [seriesRecibo, empresa, proyecto])
  const totalDeposito            = useMemo(() => recibos.reduce((sum, r) => sum + r.monto, 0), [recibos])
  const cuentaBancariaObj        = useMemo(() => cuentasBancarias.find((c) => c.codigo === cuentaBancaria), [cuentasBancarias, cuentaBancaria])

  // Maps para render props de selects
  const empresaMap         = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap        = useMemo(() => new Map(proyectos.map((p) => [`${p.empresa}-${p.codigo}`, p.nombre])), [proyectos])
  const bancoMap           = useMemo(() => new Map(bancos.map((b) => [b.codigo, b.nombre])), [bancos])
  const cuentaBancariaMap  = useMemo(() => new Map(cuentasBancarias.map((c) => [c.codigo, `${bancoMap.get(c.banco) ?? c.banco}: ${c.numero}`])), [cuentasBancarias, bancoMap])

  // ── Cascada ──
  function onEmpresaChange(val: string | null) {
    const emp         = Number(val ?? 0)
    const firstProy   = proyectos.filter((p) => p.empresa === emp)[0]?.codigo ?? 0
    const firstCuenta = cuentasBancarias.filter((c) => c.empresa === emp && c.proyecto === firstProy)[0]?.codigo ?? 0
    const firstSerie  = seriesRecibo.filter((s) => s.empresa === emp && s.proyecto === firstProy && s.activo === 1)[0]?.serie ?? ''
    setEmpresa(emp)
    setProyecto(firstProy)
    setCuentaBancaria(firstCuenta)
    setBuscarSerie(firstSerie)
    setReciboPreview(null)
    setBuscarError('')
  }

  function onProyectoChange(val: string | null) {
    const proy        = Number(val ?? 0)
    const firstCuenta = cuentasBancarias.filter((c) => c.empresa === empresa && c.proyecto === proy)[0]?.codigo ?? 0
    const firstSerie  = seriesRecibo.filter((s) => s.empresa === empresa && s.proyecto === proy && s.activo === 1)[0]?.serie ?? ''
    setProyecto(proy)
    setCuentaBancaria(firstCuenta)
    setBuscarSerie(firstSerie)
    setReciboPreview(null)
    setBuscarError('')
  }

  // ── Buscar recibo ──
  function handleBuscar() {
    const num = parseInt(buscarNumero, 10)
    if (!buscarSerie || !buscarNumero || isNaN(num) || num <= 0) {
      setBuscarError('Ingrese serie y numero de recibo validos.')
      return
    }
    setBuscarError('')
    setReciboPreview(null)
    startTransitionBuscar(async () => {
      const result = await getReciboParaDeposito(empresa, proyecto, buscarSerie, num)
      if (result.error) {
        setBuscarError(result.error)
        return
      }
      if (!result.data) {
        setBuscarError('Recibo no encontrado.')
        return
      }
      // Validar moneda compatible con la cuenta bancaria seleccionada
      if (cuentaBancariaObj && result.data.moneda !== cuentaBancariaObj.moneda) {
        setBuscarError(
          `La moneda del recibo (${result.data.moneda}) no coincide con la de la cuenta bancaria (${cuentaBancariaObj.moneda}).`
        )
        return
      }
      // Validar que no esté ya en el detalle
      const dup = recibos.find((r) => r.serie === result.data!.serie && r.numero === result.data!.numero)
      if (dup) {
        setBuscarError('Este recibo ya fue agregado al detalle.')
        return
      }
      setReciboPreview(result.data)
    })
  }

  function handleAgregarDesdePreview() {
    if (!reciboPreview) return
    setRecibos((prev) => [...prev, reciboPreview])
    setReciboPreview(null)
    setBuscarNumero('')
    setBuscarError('')
  }

  function handleQuitarRecibo(idx: number) {
    setRecibos((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleLimpiar() {
    setRecibos([])
    setNumeroDocumento('')
    setBuscarNumero('')
    setReciboPreview(null)
    setBuscarError('')
  }

  function handleGuardar() {
    if (!puedeAgregar) return
    if (recibos.length === 0) {
      toast.error('Debe agregar al menos un recibo al deposito.')
      return
    }
    if (!fecha) {
      toast.error('La fecha del deposito es requerida.')
      return
    }
    if (!numeroDocumento.trim()) {
      toast.error('El numero de documento es requerido.')
      return
    }
    if (!cuentaBancaria) {
      toast.error('Debe seleccionar una cuenta bancaria.')
      return
    }
    startTransitionSave(async () => {
      const result = await depositarPagos({
        empresa,
        proyecto,
        cuenta_bancaria:  cuentaBancaria,
        fecha,
        numero_documento: numeroDocumento.trim(),
        recibos: recibos.map((r) => ({
          cuenta:   r.cuenta,
          empresa:  r.empresa,
          proyecto: r.proyecto,
          serie:    r.serie,
          numero:   r.numero,
          monto:    r.monto,
        })),
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Deposito registrado. Transaccion: ${result.numero_transaccion}`)
        router.refresh()
        handleLimpiar()
      }
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const LABEL_CLS   = 'font-semibold tracking-wider text-muted-foreground'
  const LABEL_STYLE = { fontSize: 'var(--ui-form-label)' }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 pb-24">

      {/* ── Header ── */}
      <div className="flex items-start">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-pink-100 p-2.5">
            <CircleDollarSign className="h-5 w-5 text-pink-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Depositar Pagos</h1>
            <p className="text-sm text-muted-foreground">Registra depositos bancarios de recibos pendientes</p>
          </div>
        </div>
      </div>

      {/* ── Dos paneles ── */}
      <div className="flex gap-6 items-start">

        {/* ── Panel izquierdo — Encabezado ── */}
        <div className="w-80 shrink-0 rounded-xl border border-border/60 bg-card p-4">
          <div className="grid grid-cols-2 gap-2">

            <SectionDivider label="Identificacion" />

            {/* Empresa */}
            <div className="col-span-2 grid gap-1">
              <Label htmlFor="empresa" className={LABEL_CLS} style={LABEL_STYLE}>Empresa *</Label>
              <Select value={String(empresa)} onValueChange={onEmpresaChange}>
                <SelectTrigger variant="l-border" className="w-full">
                  <SelectValue placeholder="Selecciona empresa">
                    {(v: string) => v && Number(v) ? (empresaMap.get(Number(v)) ?? v) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Proyecto */}
            <div className="col-span-2 grid gap-1">
              <Label htmlFor="proyecto" className={LABEL_CLS} style={LABEL_STYLE}>Proyecto *</Label>
              <Select value={String(proyecto)} onValueChange={onProyectoChange} disabled={empresa === 0}>
                <SelectTrigger variant="l-border" className="w-full">
                  <SelectValue placeholder="Selecciona proyecto">
                    {(v: string) => v && Number(v) ? (proyectoMap.get(`${empresa}-${Number(v)}`) ?? v) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {proyectosFiltrados.map((p) => (
                    <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cuenta Bancaria */}
            <div className="col-span-2 grid gap-1">
              <Label htmlFor="cuenta_bancaria" className={LABEL_CLS} style={LABEL_STYLE}>Cuenta Bancaria *</Label>
              <Select value={String(cuentaBancaria)} onValueChange={(v) => setCuentaBancaria(Number(v))} disabled={proyecto === 0}>
                <SelectTrigger variant="l-border" className="w-full">
                  <SelectValue placeholder={cuentasBancariasFiltradas.length === 0 ? 'Sin cuentas activas' : 'Selecciona cuenta bancaria'}>
                    {(v: string) => v && Number(v) ? (cuentaBancariaMap.get(Number(v)) ?? v) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {cuentasBancariasFiltradas.map((c) => (
                    <SelectItem key={c.codigo} value={String(c.codigo)}>{bancoMap.get(c.banco) ?? c.banco}: {c.numero}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cuentaBancariaObj && (
                <span className="text-[11px] text-muted-foreground px-2">
                  {cuentaBancariaObj.moneda}
                </span>
              )}
            </div>

            <SectionDivider label="General" />

            {/* Fecha */}
            <div className="col-span-2 grid gap-1">
              <Label htmlFor="fecha" className={LABEL_CLS} style={LABEL_STYLE}>Fecha *</Label>
              <Input
                variant="l-border"
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            {/* Numero Documento */}
            <div className="col-span-2 grid gap-1">
              <Label htmlFor="numero_documento" className={LABEL_CLS} style={LABEL_STYLE}>Numero Documento *</Label>
              <Input
                variant="l-border"
                id="numero_documento"
                value={numeroDocumento}
                maxLength={15}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                placeholder="Numero de boleta"
              />
            </div>

          </div>
        </div>

        {/* ── Separador vertical ── */}
        <div className="w-px self-stretch bg-border/60" />

        {/* ── Panel derecho — Detalle ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Buscador */}
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <SectionDivider label="Detalle" />
            </div>

            {/* Fila de búsqueda */}
            <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end [&>*]:min-w-0">
              {/* Serie */}
              <div className="grid gap-1">
                <Label className={LABEL_CLS} style={LABEL_STYLE}>Serie</Label>
                <Select value={buscarSerie} onValueChange={(v) => { setBuscarSerie(v ?? ''); setBuscarNumero(''); setReciboPreview(null); setBuscarError('') }} disabled={proyecto === 0}>
                  <SelectTrigger variant="l-border" className="w-full">
                    <SelectValue placeholder="Serie" />
                  </SelectTrigger>
                  <SelectContent>
                    {seriesFiltradas.map((s) => (
                      <SelectItem key={s.serie} value={s.serie}>{s.serie}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Numero */}
              <div className="grid gap-1">
                <Label className={LABEL_CLS} style={LABEL_STYLE}>Numero</Label>
                <Input
                  variant="l-border"
                  type="number"
                  value={buscarNumero}
                  onChange={(e) => {
                    setBuscarNumero(e.target.value)
                    if (reciboPreview) setReciboPreview(null)
                    if (buscarError)  setBuscarError('')
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleBuscar() }}
                  placeholder="Numero"
                  disabled={proyecto === 0}
                />
              </div>

              {/* Botón Buscar */}
              <Button
                onClick={handleBuscar}
                disabled={isPendingBuscar || !buscarSerie || !buscarNumero || proyecto === 0}
                variant="outline"
                className="gap-1.5"
              >
                {isPendingBuscar
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Search className="h-4 w-4" />
                }
                Buscar
              </Button>
            </div>

            {/* Error de búsqueda */}
            {buscarError && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{buscarError}</span>
              </div>
            )}

            {/* Vista previa del recibo — siempre visible */}
            <div className="mt-3 rounded-lg border border-pink-200 bg-pink-50/40 p-3">
              <div className="grid grid-cols-4 gap-3 mb-3">
                <ViewField label="Fecha"         value={reciboPreview ? fmtDate(reciboPreview.fecha) : undefined} />
                <ViewField label="Forma Pago" value={reciboPreview ? (FORMAS_PAGO[reciboPreview.forma_pago] ?? String(reciboPreview.forma_pago)) : undefined} />
                <ViewField label="Moneda"         value={reciboPreview?.moneda} />
                <ViewField label="Monto"          value={reciboPreview ? fmt(reciboPreview.monto) : undefined} />
                <ViewField label="Cliente"        value={reciboPreview ? String(reciboPreview.cliente_codigo) : undefined} />
                <div className="col-span-3">
                  <ViewField label="Nombre"       value={reciboPreview?.cliente_nombre} />
                </div>
                <ViewField label="Tipo"           value={reciboPreview?.tipo} />
                {reciboPreview?.tipo === 'Reserva' && (
                  <>
                    <ViewField label="Fase"    value={reciboPreview.fase_nombre ?? (reciboPreview.fase ? `#${reciboPreview.fase}` : undefined)} />
                    <ViewField label="Manzana" value={reciboPreview.manzana} />
                    <ViewField label="Lote"    value={reciboPreview.lote} />
                  </>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!reciboPreview}
                  onClick={() => { setReciboPreview(null); setBuscarError('') }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="bg-pink-600 hover:bg-pink-700 text-white gap-1"
                  disabled={!reciboPreview}
                  onClick={handleAgregarDesdePreview}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar al Deposito
                </Button>
              </div>
            </div>
          </div>

          {/* Tabla de recibos */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-x-auto outline-none">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="sticky left-0 z-20 w-20 bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground">Serie</span>
                  </TableHead>
                  <TableHead>Numero</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="sticky right-0 z-20 w-10 bg-muted/30" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recibos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No hay recibos agregados. Busca y agrega recibos usando el buscador.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {recibos.map((r, idx) => (
                      <TableRow key={`${r.serie}-${r.numero}`}>
                        <TableCell className="sticky left-0 z-20 bg-card font-mono text-xs">{r.serie}</TableCell>
                        <TableCell>{r.numero}</TableCell>
                        <TableCell className="text-xs">{fmtDate(r.fecha)}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{r.cliente_nombre}</TableCell>
                        <TableCell className="text-xs">{r.tipo}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{r.moneda} {fmt(r.monto)}</TableCell>
                        <TableCell className="sticky right-0 z-20 bg-card">
                          <button
                            type="button"
                            aria-label="Quitar recibo"
                            onClick={() => handleQuitarRecibo(idx)}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Fila de totales */}
                    <TableRow className="border-t-2 border-border bg-muted/30 font-semibold">
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        Total ({recibos.length} recibo{recibos.length !== 1 ? 's' : ''})
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{cuentaBancariaObj?.moneda} {fmt(totalDeposito)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>

        </div>
      </div>

      {/* ── Footer sticky ── */}
      <div className="sticky bottom-0 bg-card border-t border-border/60 px-6 py-3 flex items-center justify-end">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleLimpiar}
            disabled={isPendingSave}
          >
            Limpiar
          </Button>
          {puedeAgregar && (
            <Button
              onClick={handleGuardar}
              disabled={isPendingSave || recibos.length === 0}
              className="bg-pink-600 hover:bg-pink-700 text-white"
            >
              {isPendingSave ? 'Guardando...' : 'Guardar Deposito'}
            </Button>
          )}
        </div>
      </div>

    </div>
  )
}
