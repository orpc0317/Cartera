'use client'

import { useState, useTransition, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  HandCoins, Search, Loader2, AlertCircle, X, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { buscarPromesas, getCuotasPendientes, registrarPagoCuotas } from '@/app/actions/pago-cuotas'
import type {
  Empresa, Proyecto, Fase, Banco, CuentaBancaria, Cobrador, SerieRecibo, ProyectoMoneda,
} from '@/lib/types/proyectos'
import type { TasaCambio } from '@/lib/types/tasas-cambio'
import type { PromesaBusqueda, PlanPagoPendiente } from '@/lib/types/pago-cuotas'

// ─── Constantes ───────────────────────────────────────────────────────────

const FORMAS_PAGO: Record<number, string> = {
  1: 'Efectivo',
  2: 'Cheque',
  3: 'Deposito',
  4: 'Transferencia',
}

const CURRENCY_FLAG_MAP = new Map<string, string>([
  ['ARS', 'ar'], ['BOB', 'bo'], ['BRL', 'br'], ['CAD', 'ca'],
  ['CLP', 'cl'], ['COP', 'co'], ['CRC', 'cr'], ['CUP', 'cu'],
  ['DOP', 'do'], ['EUR', 'eu'], ['GBP', 'gb'], ['GTQ', 'gt'],
  ['HNL', 'hn'], ['MXN', 'mx'], ['NIO', 'ni'], ['PAB', 'pa'],
  ['PEN', 'pe'], ['PYG', 'py'], ['SVC', 'sv'], ['USD', 'us'],
  ['UYU', 'uy'], ['VES', 've'],
])

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

// ─── Combobox buscable de Cobrador (codigo o nombre) ───────────────────────

function CobradorCombobox({
  cobradores, value, onChange, disabled, placeholder,
}: {
  cobradores: Cobrador[]
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>()

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return cobradores
    return cobradores.filter((c) => c.nombre.toLowerCase().includes(q) || String(c.codigo).includes(q))
  }, [cobradores, query])

  const selected = cobradores.find((c) => c.codigo === value)

  useEffect(() => {
    if (open) {
      if (wrapperRef.current) setPopoverWidth(wrapperRef.current.offsetWidth)
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    } else {
      setQuery('')
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={
          <button
            type="button"
            disabled={disabled}
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={`truncate ${!selected ? 'text-muted-foreground' : ''}`}>
              {selected ? `${selected.codigo} - ${selected.nombre}` : (placeholder ?? 'Selecciona...')}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        } />
        <PopoverContent align="start" className="p-0 overflow-hidden" style={popoverWidth ? { width: popoverWidth } : undefined}>
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Buscar por codigo o nombre..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" title="Limpiar busqueda" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.codigo}
                  type="button"
                  className={`flex w-full cursor-default items-center px-3 py-2 text-sm hover:bg-accent ${
                    c.codigo === value ? 'bg-accent/40 font-medium' : 'text-foreground/80'
                  }`}
                  onClick={() => { onChange(c.codigo); setOpen(false) }}
                >
                  <span className="flex-1 truncate text-left">{c.codigo} - {c.nombre}</span>
                  {c.codigo === value && <span className="ml-2 shrink-0 text-red-600">✓</span>}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────

type Props = {
  seriesRecibo:     SerieRecibo[]
  cobradores:       Cobrador[]
  proyectoMonedas:  ProyectoMoneda[]
  tasasCambio:      TasaCambio[]
  empresas:         Empresa[]
  proyectos:        Proyecto[]
  fases:            Fase[]
  bancos:           Banco[]
  cuentasBancarias: CuentaBancaria[]
  puedeAgregar:     boolean
}

// ─── Componente ───────────────────────────────────────────────────────────

export function PagoCuotasClient({
  seriesRecibo, cobradores, proyectoMonedas, tasasCambio,
  empresas, proyectos, fases, bancos, cuentasBancarias, puedeAgregar,
}: Props) {
  const router = useRouter()

  // ── Identificar promesa ──
  const [empresa,      setEmpresaState] = useState<number>(0)
  const [proyecto,     setProyecto]     = useState<number>(0)
  const [query,        setQuery]        = useState('')
  const [resultados,   setResultados]   = useState<PromesaBusqueda[]>([])
  const [searchError,  setSearchError]  = useState('')
  const [promesa,      setPromesa]      = useState<PromesaBusqueda | null>(null)
  const [planPago,     setPlanPago]     = useState<PlanPagoPendiente | null>(null)
  const [isPendingSearch, startSearch]  = useTransition()
  const [isPendingPlan,   startPlan]    = useTransition()
  const [isPendingSave,   startSave]    = useTransition()

  // ── Inicializacion en mount: preselecciona primera empresa/proyecto ──
  useEffect(() => {
    const firstEmpresa  = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.filter((p) => p.empresa === firstEmpresa)[0]?.codigo ?? 0
    setEmpresaState(firstEmpresa)
    setProyecto(firstProyecto)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Encabezado recibo ──
  const [serie,     setSerie]     = useState('')
  const [numero,    setNumero]    = useState('')
  const [fecha,     setFecha]     = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [cobrador,  setCobrador]  = useState(0)

  // ── Forma de pago ──
  const [formaPago,       setFormaPago]       = useState(0)
  const [banco,           setBanco]           = useState(0)
  const [cuentaBancaria,  setCuentaBancaria]  = useState(0)
  const [numCuenta,       setNumCuenta]       = useState('')
  const [numDocumento,    setNumDocumento]    = useState('')
  const [moneda,          setMoneda]          = useState('')
  const [monto,           setMonto]           = useState('')

  // ── Maps para resolver nombres ──
  const empresaMap        = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap       = useMemo(() => new Map(proyectos.map((p) => [`${p.empresa}-${p.codigo}`, p.nombre])), [proyectos])
  const faseMap           = useMemo(() => new Map(fases.map((f) => [`${f.empresa}-${f.proyecto}-${f.codigo}`, f.nombre])), [fases])
  const bancoMap          = useMemo(() => new Map(bancos.map((b) => [b.codigo, b.nombre])), [bancos])
  const cuentaBancariaMap = useMemo(() => new Map(cuentasBancarias.map((c) => [c.codigo, `${bancoMap.get(c.banco) ?? c.banco}: ${c.numero}`])), [cuentasBancarias, bancoMap])

  // ── Cascada empresa / proyecto ──
  const proyectosFiltrados = useMemo(() => proyectos.filter((p) => p.empresa === empresa), [proyectos, empresa])

  function onEmpresaChange(val: string | null) {
    const emp       = Number(val ?? 0)
    const firstProy = proyectos.filter((p) => p.empresa === emp)[0]?.codigo ?? 0
    setEmpresaState(emp)
    setProyecto(firstProy)
    setQuery('')
    setResultados([])
    setSearchError('')
  }

  function onProyectoChange(val: string | null) {
    setProyecto(Number(val ?? 0))
    setQuery('')
    setResultados([])
    setSearchError('')
  }

  // ── Buscar promesas ──
  function handleBuscar() {
    if (!empresa || !proyecto) { setSearchError('Selecciona empresa y proyecto.'); return }
    if (!query.trim()) { setSearchError('Ingresa un criterio de busqueda.'); return }
    setSearchError('')
    setResultados([])
    startSearch(async () => {
      const data = await buscarPromesas(empresa, proyecto, query.trim())
      setResultados(data)
      if (data.length === 0) setSearchError('No se encontraron promesas vigentes con ese criterio.')
    })
  }

  // ── Seleccionar una promesa de los resultados ──
  function handleSeleccionarPromesa(p: PromesaBusqueda) {
    setPromesa(p)
    setResultados([])
    setQuery('')
    setSearchError('')
    setPlanPago(null)

    const seriesDisp = seriesRecibo.filter((s) => s.activo === 1 && s.empresa === p.empresa && s.proyecto === p.proyecto)
    const defSerie    = seriesDisp.find((s) => s.predeterminado === 1) ?? seriesDisp[0]
    const monBase     = proyectoMonedas.find((m) => m.activo === 1 && m.empresa === p.empresa && m.proyecto === p.proyecto && m.predeterminado === 1)?.moneda ?? p.moneda

    setSerie(defSerie?.serie ?? '')
    setNumero('')
    setFecha(new Date().toISOString().slice(0, 10))
    setCobrador(0)
    setFormaPago(0)
    setBanco(0)
    setCuentaBancaria(0)
    setNumCuenta('')
    setNumDocumento('')
    setMoneda(monBase)
    setMonto('')

    startPlan(async () => {
      const data = await getCuotasPendientes(p.empresa, p.proyecto, p.numero)
      setPlanPago(data)
    })
  }

  function handleCambiarPromesa() {
    setPromesa(null)
    setPlanPago(null)
    setResultados([])
    setQuery('')
    setSearchError('')
  }

  function handleLimpiarFormulario() {
    if (!promesa) return
    const seriesDisp = seriesRecibo.filter((s) => s.activo === 1 && s.empresa === promesa.empresa && s.proyecto === promesa.proyecto)
    const defSerie    = seriesDisp.find((s) => s.predeterminado === 1) ?? seriesDisp[0]
    const monBase     = proyectoMonedas.find((m) => m.activo === 1 && m.empresa === promesa.empresa && m.proyecto === promesa.proyecto && m.predeterminado === 1)?.moneda ?? promesa.moneda
    setSerie(defSerie?.serie ?? '')
    setNumero('')
    setFecha(new Date().toISOString().slice(0, 10))
    setCobrador(0)
    setFormaPago(0)
    setBanco(0)
    setCuentaBancaria(0)
    setNumCuenta('')
    setNumDocumento('')
    setMoneda(monBase)
    setMonto('')
  }

  // ── Cascada forma de pago ──
  function onFormaPagoChange(v: string | null) {
    const fp = Number(v ?? 0)
    setFormaPago(fp)
    setNumCuenta('')
    setNumDocumento('')
    setBanco(fp === 2 ? (bancosDisponibles[0]?.codigo ?? 0) : 0)
    setCuentaBancaria((fp === 3 || fp === 4) ? (cuentasDisponibles[0]?.codigo ?? 0) : 0)
  }

  // ── Grabar el recibo ──
  function handleGuardar() {
    if (!promesa || !planPago) return
    if (!serie) { toast.error('Selecciona la serie de recibo.'); return }
    if (!reciboAutomatico && !numero.trim()) { toast.error('Ingresa el numero de recibo.'); return }
    if (!cobrador) { toast.error('Selecciona el cobrador.'); return }
    if (!formaPago) { toast.error('Selecciona la forma de pago.'); return }
    if (formaPago === 2 && (!banco || !numDocumento.trim())) { toast.error('Completa los datos del cheque.'); return }
    if ((formaPago === 3 || formaPago === 4) && (!cuentaBancaria || !numDocumento.trim())) { toast.error('Completa los datos de la cuenta bancaria.'); return }
    if (!moneda) { toast.error('Selecciona la moneda.'); return }
    if (montoNum <= 0) { toast.error('El monto a pagar debe ser mayor a cero.'); return }
    if (moneda !== monedaBase && !tasaCambio) { toast.error('No hay tasa de cambio registrada para esa moneda en esta fecha.'); return }

    startSave(async () => {
      const result = await registrarPagoCuotas({
        empresa:          promesa.empresa,
        proyecto:         promesa.proyecto,
        promesa:          promesa.numero,
        serie,
        numero:           reciboAutomatico ? 0 : Number(numero),
        fecha,
        cobrador,
        forma_pago:       formaPago,
        banco,
        numero_cuenta:    numCuenta,
        numero_documento: numDocumento,
        cuenta_bancaria:  cuentaBancaria,
        moneda,
        tasa_cambio:      tasaCambio ?? 1,
        monto:            montoNum,
        cliente_nombre:   promesa.cliente_nombre,
        cuotas: planPago.cuotas.map((c) => ({
          tipo_cuota:     c.tipo_cuota,
          cuota:          c.cuota,
          fecha_modifico: c.fecha_modifico,
        })),
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(
        `Recibo ${serie}-${result.numero_recibo} registrado.` +
        (result.promesa_pagada ? ' La promesa quedo totalmente pagada.' : '')
      )
      router.refresh()
      handleCambiarPromesa()
    })
  }

  // ── Valores derivados del proyecto/empresa de la promesa seleccionada ──
  const seriesDisponibles = useMemo(
    () => promesa ? seriesRecibo.filter((s) => s.activo === 1 && s.empresa === promesa.empresa && s.proyecto === promesa.proyecto) : [],
    [seriesRecibo, promesa],
  )
  const serieSeleccionada = useMemo(() => seriesDisponibles.find((s) => s.serie === serie) ?? null, [seriesDisponibles, serie])
  const reciboAutomatico  = serieSeleccionada?.recibo_automatico === 1

  const cobradoresDisponibles = useMemo(
    () => promesa ? cobradores.filter((c) => c.activo === 1 && c.empresa === promesa.empresa && c.proyecto === promesa.proyecto) : [],
    [cobradores, promesa],
  )
  const bancosDisponibles = useMemo(
    () => promesa ? bancos.filter((b) => b.empresa === promesa.empresa && b.proyecto === promesa.proyecto) : [],
    [bancos, promesa],
  )
  const cuentasDisponibles = useMemo(
    () => promesa ? cuentasBancarias.filter((cb) => cb.activo === 1 && cb.empresa === promesa.empresa && cb.proyecto === promesa.proyecto) : [],
    [cuentasBancarias, promesa],
  )
  const monedasDisponibles = useMemo(
    () => promesa ? proyectoMonedas.filter((m) => m.activo === 1 && m.empresa === promesa.empresa && m.proyecto === promesa.proyecto) : [],
    [proyectoMonedas, promesa],
  )
  const monedaBase = useMemo(() => {
    if (!promesa) return ''
    return proyectoMonedas.find((m) => m.activo === 1 && m.empresa === promesa.empresa && m.proyecto === promesa.proyecto && m.predeterminado === 1)?.moneda ?? promesa.moneda
  }, [proyectoMonedas, promesa])

  // ── Tasa de cambio vigente para la moneda seleccionada en la fecha del recibo ──
  // Se recalcula automaticamente (useMemo) cada vez que cambia fecha o moneda,
  // incluso si el usuario ya habia ingresado un monto — sin codigo adicional.
  const tasaCambio = useMemo(() => {
    if (!promesa || !moneda || moneda === monedaBase) return 1
    const candidatos = tasasCambio
      .filter((t) => t.empresa === promesa.empresa && t.proyecto === promesa.proyecto && t.moneda === moneda && t.fecha <= fecha)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    return candidatos[0]?.tasa_cambio ?? null
  }, [tasasCambio, promesa, moneda, monedaBase, fecha])

  const montoNum = useMemo(() => {
    const n = parseFloat(monto)
    return isNaN(n) ? 0 : n
  }, [monto])

  const montoBase = useMemo(() => {
    if (moneda === monedaBase) return montoNum
    if (!tasaCambio) return 0
    return montoNum * tasaCambio
  }, [montoNum, moneda, monedaBase, tasaCambio])

  // ── Distribucion del pago entre cuotas pendientes ──
  // Orden: de la cuota mas antigua a la mas reciente (ya vienen ordenadas:
  // Enganche primero, luego Financiamiento, ascendente por numero de cuota).
  // Cada cuota se cubre por completo (mora + otros + cuota) antes de pasar
  // a la siguiente; si el monto no alcanza, se aplica parcialmente y se detiene.
  const pagosPorCuota = useMemo(() => {
    const map = new Map<string, number>()
    if (!planPago) return map
    let restante = montoBase
    for (const c of planPago.cuotas) {
      if (restante <= 0) break
      const aplicar = Math.min(restante, c.saldo_total)
      if (aplicar > 0) {
        map.set(`${c.tipo_cuota}-${c.cuota}`, aplicar)
        restante -= aplicar
      }
    }
    return map
  }, [planPago, montoBase])

  const totalPendiente = useMemo(() => planPago ? planPago.cuotas.reduce((s, c) => s + c.saldo_total, 0) : 0, [planPago])
  const totalMora       = useMemo(() => planPago ? planPago.cuotas.reduce((s, c) => s + c.saldo_mora, 0) : 0, [planPago])
  const totalAplicado    = useMemo(() => { let s = 0; pagosPorCuota.forEach((v) => { s += v }); return s }, [pagosPorCuota])
  const sobrante         = Math.max(0, montoBase - totalPendiente)

  const LABEL_CLS   = 'font-semibold tracking-wider text-muted-foreground'
  const LABEL_STYLE = { fontSize: 'var(--ui-form-label)' }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 pb-24">

      {/* ── Header ── */}
      <div className="flex items-start">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-100 p-2.5">
            <HandCoins className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Pago Cuotas</h1>
            <p className="text-sm text-muted-foreground">
              Registra el pago de cuotas sobre la Promesa de un cliente
            </p>
          </div>
        </div>
      </div>

      {/* ── Identificar promesa (solo si no hay una seleccionada) ── */}
      {!promesa && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <SectionDivider label="Identificar Promesa" />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Empresa */}
            <div className="grid gap-1">
              <Label className={LABEL_CLS} style={LABEL_STYLE}>Empresa *</Label>
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
            <div className="grid gap-1">
              <Label className={LABEL_CLS} style={LABEL_STYLE}>Proyecto *</Label>
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
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="grid gap-1">
              <Label className={LABEL_CLS} style={LABEL_STYLE}>Buscar</Label>
              <Input
                variant="l-border"
                value={query}
                onChange={(e) => { setQuery(e.target.value); if (searchError) setSearchError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleBuscar() }}
                placeholder="N. promesa, referencia, codigo o nombre de cliente..."
                disabled={proyecto === 0}
              />
            </div>
            <Button onClick={handleBuscar} disabled={isPendingSearch || proyecto === 0} variant="outline" className="gap-1.5">
              {isPendingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
          </div>

          {searchError && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {resultados.length > 0 && (
            <div className="mt-3 rounded-lg border border-border/60 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Promesa</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultados.map((r) => (
                    <TableRow
                      key={`${r.empresa}-${r.proyecto}-${r.numero}`}
                      className="cursor-pointer hover:bg-red-50/60"
                      onClick={() => handleSeleccionarPromesa(r)}
                    >
                      <TableCell className="font-mono text-xs">{r.numero}</TableCell>
                      <TableCell className="text-xs">{r.referencia}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{r.cliente_codigo} - {r.cliente_nombre}</TableCell>
                      <TableCell className="text-xs">{fmtDate(r.fecha)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50">Seleccionar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ── Promesa identificada + resto de la pantalla ── */}
      {promesa && (
        <>
          {/* Barra resumen de la promesa */}
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 flex items-start justify-between gap-4">
            <div className="grid grid-cols-4 md:grid-cols-7 gap-3 flex-1">
              <ViewField label="Promesa"    value={String(promesa.numero)} />
              <ViewField label="Referencia" value={promesa.referencia} />
              <div className="col-span-2">
                <ViewField label="Cliente" value={`${promesa.cliente_codigo} - ${promesa.cliente_nombre}`} />
              </div>
              <ViewField label="Empresa"  value={empresaMap.get(promesa.empresa) ?? String(promesa.empresa)} />
              <ViewField label="Proyecto" value={proyectoMap.get(`${promesa.empresa}-${promesa.proyecto}`) ?? String(promesa.proyecto)} />
              <ViewField label="Fase"     value={faseMap.get(`${promesa.empresa}-${promesa.proyecto}-${promesa.fase}`) ?? String(promesa.fase)} />
            </div>
            <Button variant="outline" size="sm" onClick={handleCambiarPromesa}>Cambiar Promesa</Button>
          </div>

          {/* ── Dos paneles ── */}
          <div className="flex gap-6 items-start">

            {/* ── Panel izquierdo — Encabezado + Forma de Pago ── */}
            <div className="w-80 shrink-0 rounded-xl border border-border/60 bg-card p-4">
              <div className="grid grid-cols-2 gap-2">

                <SectionDivider label="Encabezado Recibo" />

                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label className={LABEL_CLS} style={LABEL_STYLE}>Serie *</Label>
                    <Select value={serie} onValueChange={(v) => setSerie(v ?? '')}>
                      <SelectTrigger variant="l-border" className="w-full">
                        <SelectValue placeholder={seriesDisponibles.length === 0 ? 'Sin series' : 'Serie'} />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesDisponibles.map((s) => (
                          <SelectItem key={s.serie} value={s.serie}>{s.serie}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {!reciboAutomatico ? (
                    <div className="grid gap-1">
                      <Label className={LABEL_CLS} style={LABEL_STYLE}>Numero *</Label>
                      <Input variant="l-border" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="No. recibo" />
                    </div>
                  ) : (
                    <div className="grid gap-1">
                      <Label className={LABEL_CLS} style={LABEL_STYLE}>Numero</Label>
                      <div className="flex items-center rounded-none bg-muted/40 border-0 border-b border-border px-2 text-muted-foreground" style={{ height: 'var(--ui-field-height)', fontSize: 'var(--ui-input)' }}>
                        Automatico
                      </div>
                    </div>
                  )}
                </div>

                <div className="col-span-2 grid gap-1">
                  <Label className={LABEL_CLS} style={LABEL_STYLE}>Fecha *</Label>
                  <Input variant="l-border" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>

                <div className="col-span-2 grid gap-1">
                  <Label className={LABEL_CLS} style={LABEL_STYLE}>Cobrador *</Label>
                  <CobradorCombobox
                    cobradores={cobradoresDisponibles}
                    value={cobrador}
                    onChange={setCobrador}
                    placeholder="Selecciona cobrador..."
                  />
                </div>

                <SectionDivider label="Forma de Pago" />

                <div className="col-span-2 grid gap-1">
                  <Label className={LABEL_CLS} style={LABEL_STYLE}>Forma de Pago *</Label>
                  <Select value={formaPago ? String(formaPago) : ''} onValueChange={onFormaPagoChange}>
                    <SelectTrigger variant="l-border" className="w-full">
                      <SelectValue placeholder="Selecciona forma de pago">{(v: string) => v ? (FORMAS_PAGO[Number(v)] ?? v) : null}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FORMAS_PAGO).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formaPago === 2 && (
                  <>
                    <div className="col-span-2 grid gap-1">
                      <Label className={LABEL_CLS} style={LABEL_STYLE}>Banco *</Label>
                      <Select value={banco ? String(banco) : ''} onValueChange={(v) => setBanco(Number(v))}>
                        <SelectTrigger variant="l-border" className="w-full">
                          <SelectValue placeholder={bancosDisponibles.length === 0 ? 'Sin bancos registrados' : 'Selecciona banco'}>{(v: string) => v ? (bancoMap.get(Number(v)) ?? v) : null}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {bancosDisponibles.map((b) => (
                            <SelectItem key={b.codigo} value={String(b.codigo)}>{b.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label className={LABEL_CLS} style={LABEL_STYLE}>No. Cuenta *</Label>
                      <Input variant="l-border" value={numCuenta} onChange={(e) => setNumCuenta(e.target.value)} placeholder="Numero de cuenta" />
                    </div>
                    <div className="grid gap-1">
                      <Label className={LABEL_CLS} style={LABEL_STYLE}>No. Documento *</Label>
                      <Input variant="l-border" value={numDocumento} onChange={(e) => setNumDocumento(e.target.value)} placeholder="Numero de cheque" />
                    </div>
                  </>
                )}

                {(formaPago === 3 || formaPago === 4) && (
                  <>
                    <div className="col-span-2 grid gap-1">
                      <Label className={LABEL_CLS} style={LABEL_STYLE}>Cuenta Bancaria *</Label>
                      <Select value={cuentaBancaria ? String(cuentaBancaria) : ''} onValueChange={(v) => setCuentaBancaria(Number(v))}>
                        <SelectTrigger variant="l-border" className="w-full">
                          <SelectValue placeholder={cuentasDisponibles.length === 0 ? 'Sin cuentas activas' : 'Selecciona cuenta bancaria'}>{(v: string) => v ? (cuentaBancariaMap.get(Number(v)) ?? v) : null}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {cuentasDisponibles.map((cb) => (
                            <SelectItem key={cb.codigo} value={String(cb.codigo)}>{bancoMap.get(cb.banco) ?? cb.banco}: {cb.numero}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 grid gap-1">
                      <Label className={LABEL_CLS} style={LABEL_STYLE}>No. Documento *</Label>
                      <Input variant="l-border" value={numDocumento} onChange={(e) => setNumDocumento(e.target.value)} placeholder="Numero de documento" />
                    </div>
                  </>
                )}

                <SectionDivider label="Monto" />

                <div className="grid gap-1">
                  <Label className={LABEL_CLS} style={LABEL_STYLE}>Moneda *</Label>
                  <Select value={moneda} onValueChange={(v) => setMoneda(v ?? '')}>
                    <SelectTrigger variant="l-border" className="w-full">
                      <SelectValue placeholder={monedasDisponibles.length === 0 ? 'Sin monedas' : 'Selecciona moneda'}>
                        {(v: string) => {
                          if (!v) return null
                          const flag = CURRENCY_FLAG_MAP.get(v)
                          return (
                            <span className="flex items-center gap-1.5">
                              {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} width={20} height={14} alt={v} className="rounded-[2px] shrink-0" />}
                              {v}
                            </span>
                          )
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {monedasDisponibles.map((m) => {
                        const flag = CURRENCY_FLAG_MAP.get(m.moneda)
                        return (
                          <SelectItem key={m.moneda} value={m.moneda}>
                            <span className="flex items-center gap-1.5">
                              {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} width={20} height={14} alt={m.moneda} className="rounded-[2px]" />}
                              {m.moneda}
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1">
                  <Label className={LABEL_CLS} style={LABEL_STYLE}>Monto a Pagar *</Label>
                  <Input
                    variant="l-border"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                {moneda && moneda !== monedaBase && (
                  <div className="col-span-2">
                    <ViewField label={`Tasa de Cambio (${moneda} > ${monedaBase})`} value={tasaCambio ? tasaCambio.toFixed(4) : undefined} />
                    {!tasaCambio && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>No hay tasa de cambio registrada para {moneda} en o antes de esta fecha.</span>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            {/* ── Separador vertical ── */}
            <div className="w-px self-stretch bg-border/60" />

            {/* ── Panel derecho — Cuotas a Pagar ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">

              <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-x-auto outline-none">
                {isPendingPlan ? (
                  <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando cuotas...
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Tipo</TableHead>
                        <TableHead>No.</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Cuota</TableHead>
                        {planPago?.otrosColumnas.map((col) => (
                          <TableHead key={col.codigo} className="text-right">{col.etiqueta}</TableHead>
                        ))}
                        <TableHead className="text-right">Mora</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead className="text-right">Pagar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!planPago || planPago.cuotas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7 + (planPago?.otrosColumnas.length ?? 0)} className="py-8 text-center text-sm text-muted-foreground">
                            No hay cuotas pendientes para esta promesa.
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {planPago.cuotas.map((c) => {
                            const key   = `${c.tipo_cuota}-${c.cuota}`
                            const pagar = pagosPorCuota.get(key) ?? 0
                            return (
                              <TableRow key={key}>
                                <TableCell className="text-xs">{c.tipo_cuota === 1 ? 'Enganche' : 'Financiamiento'}</TableCell>
                                <TableCell>{c.cuota}</TableCell>
                                <TableCell className="text-xs">{fmtDate(c.fecha)}</TableCell>
                                <TableCell className="text-right font-mono text-sm">{fmt(c.saldo_cuota)}</TableCell>
                                {planPago.otrosColumnas.map((col) => {
                                  const o = c.otros.find((x) => x.codigo === col.codigo)
                                  return <TableCell key={col.codigo} className="text-right font-mono text-sm">{fmt(o?.saldo ?? 0)}</TableCell>
                                })}
                                <TableCell className="text-right font-mono text-sm">{fmt(c.saldo_mora)}</TableCell>
                                <TableCell className="text-right font-mono text-sm font-medium">{fmt(c.saldo_total)}</TableCell>
                                <TableCell className={`text-right font-mono text-sm ${pagar > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                                  {pagar > 0 ? fmt(pagar) : '—'}
                                </TableCell>
                              </TableRow>
                            )
                          })}

                          {/* Fila de totales */}
                          <TableRow className="border-t-2 border-border bg-muted/30 font-semibold">
                            <TableCell colSpan={4 + planPago.otrosColumnas.length} className="text-sm text-muted-foreground">
                              Total ({planPago.cuotas.length} cuota{planPago.cuotas.length !== 1 ? 's' : ''})
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{fmt(totalMora)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{fmt(totalPendiente)}</TableCell>
                            <TableCell className="text-right font-mono text-sm text-red-600">{fmt(totalAplicado)}</TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>

            </div>
          </div>

          {/* ── Footer sticky ── */}
          <div className="sticky bottom-0 bg-card border-t border-border/60 px-6 py-3 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground max-w-xs">
              El monto se aplica de la cuota mas antigua a la mas reciente (mora, otros ingresos, intereses y capital, en ese orden).
            </p>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">Monto a Pagar</span>
                <span className="font-mono text-sm font-semibold">{moneda} {fmt(montoNum)}</span>
              </div>
              {moneda !== monedaBase && (
                <div className="text-right">
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">Equivalente ({monedaBase})</span>
                  <span className="font-mono text-sm font-semibold">{monedaBase} {fmt(montoBase)}</span>
                </div>
              )}
              <div className="text-right">
                <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">Aplicado</span>
                <span className="font-mono text-sm font-semibold text-red-600">{monedaBase} {fmt(totalAplicado)}</span>
              </div>
              {sobrante > 0 && (
                <div className="text-right">
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">Sobrante</span>
                  <span className="font-mono text-sm font-semibold text-amber-600">{monedaBase} {fmt(sobrante)}</span>
                </div>
              )}
              <Button variant="outline" onClick={handleLimpiarFormulario} disabled={isPendingSave}>Limpiar</Button>
              {puedeAgregar && (
                <Button
                  onClick={handleGuardar}
                  disabled={isPendingSave || isPendingPlan || montoNum <= 0}
                  className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
                >
                  {isPendingSave && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isPendingSave ? 'Guardando...' : 'Guardar Recibo'}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  )
}
