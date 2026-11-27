'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CircleDollarSign, Search, Trash2, Plus, AlertCircle, Loader2, Landmark, List, Receipt, FileText,
  Check, ChevronLeft, ChevronRight, Eraser,
} from 'lucide-react'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/required-mark'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { LIST_BLOCK, LIST_HEAD, LIST_HEAD_BG, LIST_SHELL, LIST_THEAD } from '@/lib/list-table'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { getReciboParaDeposito, depositarPagos } from '@/app/actions/depositar-pagos'
import type { Empresa, Proyecto, Banco, CuentaBancaria, SerieRecibo } from '@/lib/types/proyectos'
import type { ReciboDetalleItem } from '@/lib/types/depositar-pagos'
import { useCampoInvalido } from '@/lib/campo-invalido'
import { FormWizard, useWizardNav, type WizardStep } from '@/components/ui/form-wizard'
import { SegmentCard } from '@/components/ui/segment-card'
import { ViewField } from '@/components/ui/view-field'
import { MensajeCampo } from '@/components/ui/mensaje-campo'
import { CLASE_BOTON_MODAL, FONDO_MODAL, FRANJA_BLANCA } from '@/lib/modal-look'

const PASOS_DEPOSITO: readonly WizardStep[] = [
  { id: 'general', label: 'General', icon: Landmark },
  { id: 'detalle', label: 'Detalle', icon: List },
]

// ─── Constantes ───────────────────────────────────────────────────────────

const FORMAS_PAGO: Record<number, string> = {
  1: 'Efectivo',
  2: 'Cheque',
  3: 'Deposito',
  4: 'Transferencia'
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

function BanderaMonto({ codigo, monto }: { codigo?: string | null; monto?: number | null }) {
  if (!codigo || monto == null) return null
  const flagIso = CURRENCY_FLAG_MAP.get(codigo)
  return (
    <span className="inline-flex items-center gap-1.5">
      {flagIso && (
        <img src={`https://flagcdn.com/w20/${flagIso}.png`} alt={codigo} width={20} height={14} className="object-cover rounded-sm shrink-0" />
      )}
      <span className="whitespace-nowrap">{codigo} {fmt(monto)}</span>
    </span>
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
  const { activeTab, setActiveTab, campoInvalido, rechazar, limpiarCampoInvalido } = useCampoInvalido('general')
  const wizard = useWizardNav(PASOS_DEPOSITO, activeTab, setActiveTab, true)
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
    limpiarCampoInvalido()
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
    limpiarCampoInvalido()
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
    limpiarCampoInvalido()
    setRecibos((prev) => [...prev, reciboPreview])
    setReciboPreview(null)
    setBuscarNumero('')
    setBuscarError('')
  }

  function handleQuitarRecibo(idx: number) {
    setRecibos((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleLimpiar() {
    limpiarCampoInvalido()
    setRecibos([])
    setNumeroDocumento('')
    setBuscarNumero('')
    setReciboPreview(null)
    setBuscarError('')
    wizard.reiniciar()
  }

  function handleGuardar() {
    if (!puedeAgregar) return
    if (recibos.length === 0) {
      rechazar('buscar_numero', 'Debe agregar al menos un recibo al deposito.', 'detalle')
      return
    }
    if (!fecha) {
      rechazar('fecha', 'La fecha del deposito es requerida.', 'general')
      return
    }
    if (!numeroDocumento.trim()) {
      rechazar('numero_documento', 'El numero de documento es requerido.', 'general')
      return
    }
    if (!cuentaBancaria) {
      rechazar('cuenta_bancaria', 'Debe seleccionar una cuenta bancaria.', 'general')
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
    <div className={LIST_SHELL}>

      {/* ── Header ── */}
      <div className={`${LIST_BLOCK} flex items-start`}>
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

      <div className={`mx-auto flex h-[700px] max-h-[calc(100dvh-10rem)] min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border/60 ${FONDO_MODAL} ${activeTab === 'detalle' ? 'max-w-3xl' : 'max-w-xl'}`}>
      <FormWizard
        steps={PASOS_DEPOSITO}
        value={activeTab}
        onValueChange={setActiveTab}
        maxIndice={wizard.maxIndice}
        className="min-h-0 flex-1"
        navClassName={`border-b px-4 py-2 ${FRANJA_BLANCA}`}
        contenidoClassName="px-4 py-3"
      >
        {activeTab === 'general' && (
        <div className="grid grid-cols-2 gap-2">
          <SegmentCard label="IDENTIFICACION">

            {/* Empresa */}
            <div className="col-span-2 grid gap-1">
              <Label htmlFor="empresa" className={LABEL_CLS} style={LABEL_STYLE}>Empresa <RequiredMark /></Label>
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
              <Label htmlFor="proyecto" className={LABEL_CLS} style={LABEL_STYLE}>Proyecto <RequiredMark /></Label>
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
              <Label htmlFor="cuenta_bancaria" className={LABEL_CLS} style={LABEL_STYLE}>Cuenta Bancaria <RequiredMark /></Label>
              <Select value={String(cuentaBancaria)} onValueChange={(v) => { limpiarCampoInvalido(); setCuentaBancaria(Number(v)) }} disabled={proyecto === 0}>
                <SelectTrigger variant="l-border" id="cuenta_bancaria" aria-invalid={campoInvalido?.id === 'cuenta_bancaria' || undefined} className="w-full">
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
              <MensajeCampo id="cuenta_bancaria" campo={campoInvalido} />
              {cuentaBancariaObj && (
                <span className="text-[11px] text-muted-foreground px-2">
                  {cuentaBancariaObj.moneda}
                </span>
              )}
            </div>
          </SegmentCard>

          <SegmentCard label="GENERAL" icon={FileText}>
            <div className="col-span-2 grid grid-cols-4 gap-2">
            {/* Fecha */}
            <div className="col-span-1 grid min-w-0 gap-1">
              <Label htmlFor="fecha" className={LABEL_CLS} style={LABEL_STYLE}>Fecha <RequiredMark /></Label>
              <Input
                variant="l-border"
                id="fecha"
                aria-invalid={campoInvalido?.id === 'fecha' || undefined}
                type="date"
                value={fecha}
                onChange={(e) => { limpiarCampoInvalido(); setFecha(e.target.value) }}
              />
              <MensajeCampo id="fecha" campo={campoInvalido} />
            </div>

            {/* Numero Documento */}
            <div className="col-span-1 grid min-w-0 gap-1">
              <Label htmlFor="numero_documento" className={LABEL_CLS} style={LABEL_STYLE}>Numero Documento <RequiredMark /></Label>
              <Input
                variant="l-border"
                id="numero_documento"
                aria-invalid={campoInvalido?.id === 'numero_documento' || undefined}
                value={numeroDocumento}
                maxLength={15}
                onChange={(e) => { limpiarCampoInvalido(); setNumeroDocumento(e.target.value) }}
                placeholder="Numero de boleta"
              />
              <MensajeCampo id="numero_documento" campo={campoInvalido} />
            </div>
            </div>
          </SegmentCard>

        </div>
        )}

        {activeTab === 'detalle' && (
        <div className="grid grid-cols-2 gap-2">
          <SegmentCard label="RECIBOS" icon={Receipt}>

            <div className="col-span-2 grid grid-cols-4 items-end gap-3">
              <div className="col-span-1 grid min-w-0 gap-1">
                <Label className={LABEL_CLS} style={LABEL_STYLE}>Serie</Label>
                <Select value={buscarSerie} onValueChange={(v) => { limpiarCampoInvalido(); setBuscarSerie(v ?? ''); setBuscarNumero(''); setReciboPreview(null); setBuscarError('') }} disabled={proyecto === 0}>
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

              <div className="col-span-1 grid min-w-0 gap-1">
                <Label className={LABEL_CLS} style={LABEL_STYLE}>Numero</Label>
                <Input
                  variant="l-border"
                  id="buscar_numero"
                  aria-invalid={campoInvalido?.id === 'buscar_numero' || undefined}
                  type="number"
                  value={buscarNumero}
                  onChange={(e) => {
                    limpiarCampoInvalido()
                    setBuscarNumero(e.target.value)
                    if (reciboPreview) setReciboPreview(null)
                    if (buscarError)  setBuscarError('')
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleBuscar() }}
                  placeholder="Numero"
                  disabled={proyecto === 0}
                />
                <MensajeCampo id="buscar_numero" campo={campoInvalido} />
              </div>

              <Button
                onClick={handleBuscar}
                disabled={isPendingBuscar || !buscarSerie || !buscarNumero || proyecto === 0}
                variant="outline"
                className="w-fit gap-1.5"
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
              <div className="col-span-2 flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{buscarError}</span>
              </div>
            )}

            <div className="col-span-2 grid grid-cols-4 gap-3">
                <ViewField label="Fecha" value={reciboPreview ? fmtDate(reciboPreview.fecha) : undefined} />
                <ViewField label="Forma Pago" value={reciboPreview ? (FORMAS_PAGO[reciboPreview.forma_pago] ?? String(reciboPreview.forma_pago)) : undefined} />
                <div className="col-span-1 grid min-w-0 gap-1">
                  <span className="font-semibold tracking-wider leading-none text-muted-foreground" style={{ fontSize: 'var(--ui-viewfield-label)' }}>Monto</span>
                  <div className="flex min-w-0 items-center rounded-none bg-transparent border-0 border-b border-primary/50 px-2" style={{ height: 'var(--ui-field-height)' }}>
                    <span className="min-w-0 font-medium text-foreground" style={{ fontSize: 'var(--ui-viewfield-value)' }}>
                      <BanderaMonto codigo={reciboPreview?.moneda} monto={reciboPreview?.monto} />
                    </span>
                  </div>
                </div>
            </div>
            <div className="col-span-2 grid grid-cols-4 gap-3">
                <ViewField label="Cliente" value={reciboPreview ? String(reciboPreview.cliente_codigo) : undefined} />
                <div className="col-span-3 min-w-0">
                  <ViewField label="Nombre Cliente" value={reciboPreview?.cliente_nombre} />
                </div>
            </div>
            <div className="col-span-2 grid grid-cols-4 gap-3">
                <ViewField label="Tipo" value={reciboPreview?.tipo} />
                {reciboPreview?.tipo === 'Reserva' && (
                  <>
                    <ViewField label="Fase"    value={reciboPreview.fase_nombre ?? (reciboPreview.fase ? `#${reciboPreview.fase}` : undefined)} />
                    <ViewField label="Manzana" value={reciboPreview.manzana} />
                    <ViewField label="Lote"    value={reciboPreview.lote} />
                  </>
                )}
            </div>
            <div className="col-span-2 flex justify-end gap-2">
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
                  Agregar
                </Button>
            </div>

          <div className="col-span-2 max-h-72 overflow-auto rounded-md border border-border/60">
            <Table scrollable={false}>
              <TableHeader className={LIST_THEAD}>
                <TableRow className={LIST_HEAD_BG}>
                  <TableHead className={LIST_HEAD}>
                    <span className="text-xs font-medium text-muted-foreground">Serie</span>
                  </TableHead>
                  <TableHead className={LIST_HEAD}>Numero</TableHead>
                  <TableHead className={LIST_HEAD}>Fecha</TableHead>
                  <TableHead className={LIST_HEAD}>Cliente</TableHead>
                  <TableHead className={LIST_HEAD}>Tipo</TableHead>
                  <TableHead className={`${LIST_HEAD} text-right`}>Monto</TableHead>
                  <TableHead className={`${LIST_HEAD} w-10`} />
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
                        <TableCell className="font-mono text-xs">{r.serie}</TableCell>
                        <TableCell>{r.numero}</TableCell>
                        <TableCell className="text-xs">{fmtDate(r.fecha)}</TableCell>
                        <TableCell className="truncate">{r.cliente_nombre}</TableCell>
                        <TableCell className="text-xs">{r.tipo}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono text-sm">
                          <BanderaMonto codigo={r.moneda} monto={r.monto} />
                        </TableCell>
                        <TableCell>
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
                      <TableCell className="whitespace-nowrap text-right font-mono text-sm">
                        <BanderaMonto codigo={cuentaBancariaObj?.moneda} monto={totalDeposito} />
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
          </SegmentCard>

        </div>
        )}
      </FormWizard>

      <div className={`flex shrink-0 flex-col-reverse gap-2 rounded-b-xl border-t border-border/50 p-4 sm:flex-row sm:justify-end ${FRANJA_BLANCA}`}>
        <Button type="button" variant="ghost" size="sm" className={CLASE_BOTON_MODAL} onClick={handleLimpiar} disabled={isPendingSave}>
          <Eraser className="mr-1.5 h-3.5 w-3.5" /> Limpiar
        </Button>
        {!wizard.esPrimero && (
          <Button type="button" variant="ghost" size="sm" className={CLASE_BOTON_MODAL} onClick={wizard.anterior} disabled={isPendingSave}>
            <ChevronLeft className="mr-1.5 h-3.5 w-3.5" /> Anterior
          </Button>
        )}
        {!wizard.esUltimo ? (
          <Button type="button" variant="ghost" size="sm" className={CLASE_BOTON_MODAL} onClick={wizard.siguiente} disabled={isPendingSave}>
            Siguiente <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ) : puedeAgregar && (
          <Button type="button" variant="ghost" size="sm" className={CLASE_BOTON_MODAL} onClick={handleGuardar} disabled={isPendingSave}>
            <Check className="mr-1.5 h-3.5 w-3.5" /> {isPendingSave ? 'Guardando...' : 'Guardar'}
          </Button>
        )}
      </div>
      </div>

    </div>
  )
}
