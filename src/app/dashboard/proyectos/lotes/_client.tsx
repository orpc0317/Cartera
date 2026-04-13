'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Plus, MapPin, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { createLote, updateLote, deleteLote } from '@/app/actions/lotes'
import { getLoteEstado } from '@/lib/types/proyectos'
import type { Empresa, Proyecto, Fase, Manzana, Lote, LoteForm } from '@/lib/types/proyectos'

const MONEDAS = [
  { value: 'GTQ', label: 'Q — Quetzal' },
  { value: 'USD', label: '$ — Dólar USD' },
]

const EMPTY_FORM: LoteForm = {
  empresa: 0,
  proyecto: 0,
  fase: 0,
  manzana: '',
  codigo: '',
  moneda: 'GTQ',
  valor: 0,
  extension: 0,
  finca: '',
  folio: '',
  libro: '',
  norte: '',
  sur: '',
  este: '',
  oeste: '',
  otro: '',
}

function EstadoBadge({ lote }: { lote: Lote }) {
  const estado = getLoteEstado(lote)
  return estado === 'disponible' ? (
    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
      Disponible
    </Badge>
  ) : (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
      Con Promesa
    </Badge>
  )
}

export function LotesClient({
  initialData,
  empresas,
  proyectos,
  fases,
  manzanas,
}: {
  initialData: Lote[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  fases: Fase[]
  manzanas: Manzana[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState<'todos' | 'disponible' | 'con-promesa'>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Lote | null>(null)
  const [editTarget, setEditTarget] = useState<Lote | null>(null)
  const [form, setForm] = useState<LoteForm>(EMPTY_FORM)

  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.codigo, p.nombre])), [proyectos])
  const faseMap = useMemo(() => new Map(fases.map((f) => [f.codigo, f.nombre])), [fases])

  const proyectosFiltrados = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa]
  )
  const fasesFiltradas = useMemo(
    () => fases.filter((f) => f.empresa === form.empresa && f.proyecto === form.proyecto),
    [fases, form.empresa, form.proyecto]
  )
  const manzanasFiltradas = useMemo(
    () => manzanas.filter((m) => m.empresa === form.empresa && m.proyecto === form.proyecto && m.fase === form.fase),
    [manzanas, form.empresa, form.proyecto, form.fase]
  )

  const filtered = useMemo(() => {
    return initialData.filter((l) => {
      const matchSearch =
        l.codigo.toLowerCase().includes(search.toLowerCase()) ||
        l.manzana.toLowerCase().includes(search.toLowerCase()) ||
        (empresaMap.get(l.empresa) ?? '').toLowerCase().includes(search.toLowerCase())
      const estado = getLoteEstado(l)
      const matchEstado =
        filterEstado === 'todos' ||
        (filterEstado === 'disponible' && estado === 'disponible') ||
        (filterEstado === 'con-promesa' && estado === 'con-promesa')
      return matchSearch && matchEstado
    })
  }, [initialData, search, filterEstado, empresaMap])

  function openCreate() {
    setEditTarget(null)
    const firstEmpresa = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)?.codigo ?? 0
    const firstFase = fases.find((f) => f.empresa === firstEmpresa && f.proyecto === firstProyecto)?.codigo ?? 0
    const firstManzana = manzanas.find(
      (m) => m.empresa === firstEmpresa && m.proyecto === firstProyecto && m.fase === firstFase
    )?.codigo ?? ''
    setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto, fase: firstFase, manzana: firstManzana })
    setDialogOpen(true)
  }

  function openEdit(lote: Lote) {
    setEditTarget(lote)
    setForm({
      empresa: lote.empresa,
      proyecto: lote.proyecto,
      fase: lote.fase,
      manzana: lote.manzana,
      codigo: lote.codigo,
      moneda: lote.moneda ?? 'GTQ',
      valor: lote.valor ?? 0,
      extension: lote.extension ?? 0,
      finca: lote.finca ?? '',
      folio: lote.folio ?? '',
      libro: lote.libro ?? '',
      norte: lote.norte ?? '',
      sur: lote.sur ?? '',
      este: lote.este ?? '',
      oeste: lote.oeste ?? '',
      otro: lote.otro ?? '',
    })
    setDialogOpen(true)
  }

  function f(key: keyof LoteForm, value: string | number) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'empresa') {
        const firstP = proyectos.find((p) => p.empresa === Number(value))
        next.proyecto = firstP?.codigo ?? 0
        const firstF = fases.find((f2) => f2.empresa === Number(value) && f2.proyecto === next.proyecto)
        next.fase = firstF?.codigo ?? 0
        const firstM = manzanas.find((m) => m.empresa === Number(value) && m.proyecto === next.proyecto && m.fase === next.fase)
        next.manzana = firstM?.codigo ?? ''
      }
      if (key === 'proyecto') {
        const firstF = fases.find((f2) => f2.empresa === prev.empresa && f2.proyecto === Number(value))
        next.fase = firstF?.codigo ?? 0
        const firstM = manzanas.find((m) => m.empresa === prev.empresa && m.proyecto === Number(value) && m.fase === next.fase)
        next.manzana = firstM?.codigo ?? ''
      }
      if (key === 'fase') {
        const firstM = manzanas.find((m) => m.empresa === prev.empresa && m.proyecto === prev.proyecto && m.fase === Number(value))
        next.manzana = firstM?.codigo ?? ''
      }
      return next
    })
  }

  function handleSave() {
    if (!form.codigo.trim()) { toast.error('El código del lote es requerido.'); return }
    if (!form.manzana.trim()) { toast.error('Selecciona la manzana.'); return }
    startTransition(async () => {
      const result = editTarget
        ? await updateLote(editTarget.empresa, editTarget.proyecto, editTarget.fase, editTarget.manzana, editTarget.codigo, form)
        : await createLote(form)
      if (result.error) toast.error(result.error)
      else {
        toast.success(editTarget ? 'Lote actualizado.' : 'Lote creado.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteLote(
        deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.fase,
        deleteTarget.manzana, deleteTarget.codigo
      )
      if (result.error) toast.error(result.error)
      else { toast.success('Lote eliminado.'); router.refresh() }
      setDeleteTarget(null)
    })
  }

  const disponibles = initialData.filter((l) => getLoteEstado(l) === 'disponible').length
  const conPromesa = initialData.length - disponibles

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 p-2.5">
            <MapPin className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Lotes</h1>
            <p className="text-sm text-muted-foreground">Catálogo completo de lotes y su estado</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2" disabled={manzanas.length === 0}>
          <Plus className="h-4 w-4" />
          Nuevo Lote
        </Button>
      </div>

      {/* Stats chips */}
      {initialData.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs">
            <span className="h-2 w-2 rounded-full bg-foreground/30" />
            {initialData.length} lotes totales
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs border-emerald-200 text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {disponibles} disponibles
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs border-amber-200 text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {conPromesa} con promesa
          </Badge>
        </div>
      )}

      {manzanas.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Primero crea manzanas antes de agregar lotes.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar lotes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['todos', 'disponible', 'con-promesa'] as const).map((v) => (
            <Button
              key={v}
              variant={filterEstado === v ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterEstado(v)}
              className="capitalize"
            >
              {v === 'todos' ? 'Todos' : v === 'disponible' ? 'Disponibles' : 'Con Promesa'}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Código</TableHead>
              <TableHead className="hidden md:table-cell">Manzana</TableHead>
              <TableHead className="hidden md:table-cell">Empresa/Proyecto</TableHead>
              <TableHead className="hidden lg:table-cell">Extensión</TableHead>
              <TableHead className="hidden lg:table-cell">Valor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                  {search || filterEstado !== 'todos' ? 'Sin resultados para ese filtro.' : 'No hay lotes registrados aún.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lote) => (
                <TableRow key={`${lote.empresa}-${lote.proyecto}-${lote.fase}-${lote.manzana}-${lote.codigo}`} className="group">
                  <TableCell className="font-medium">{lote.codigo}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{lote.manzana}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{empresaMap.get(lote.empresa) ?? `#${lote.empresa}`}</span>
                      <span className="text-xs text-muted-foreground">{proyectoMap.get(lote.proyecto) ?? `#${lote.proyecto}`}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {lote.extension ? `${lote.extension.toLocaleString()} ${faseMap.get(lote.fase) ? '' : ''}` : '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-mono text-sm">
                    {lote.valor
                      ? new Intl.NumberFormat('es-GT', { style: 'currency', currency: lote.moneda ?? 'GTQ' }).format(lote.valor)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <EstadoBadge lote={lote} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground group-hover:opacity-100 focus-visible:outline-none"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(lote)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(lote)}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex flex-col w-full max-w-2xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar Lote' : 'Nuevo Lote'}</DialogTitle>
          </DialogHeader>

            <Tabs defaultValue="ubicacion" className="mt-2 flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="ubicacion">Ubicación</TabsTrigger>
              <TabsTrigger value="datos">Datos Generales</TabsTrigger>
              <TabsTrigger value="colindancias">Colindancias</TabsTrigger>
            </TabsList>

            {/* Ubicación */}
            <TabsContent value="ubicacion" className="mt-4 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 grid gap-1.5">
                  <Label>Empresa *</Label>
                  <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))}>
                    <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
                    <SelectContent>{empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 grid gap-1.5">
                  <Label>Proyecto *</Label>
                  <Select value={String(form.proyecto)} onValueChange={(v) => f('proyecto', Number(v))}>
                    <SelectTrigger><SelectValue placeholder="Proyecto" /></SelectTrigger>
                    <SelectContent>{proyectosFiltrados.map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label>Fase *</Label>
                  <Select value={String(form.fase)} onValueChange={(v) => f('fase', Number(v))}>
                    <SelectTrigger><SelectValue placeholder="Fase" /></SelectTrigger>
                    <SelectContent>{fasesFiltradas.map((f2) => <SelectItem key={f2.codigo} value={String(f2.codigo)}>{f2.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label>Manzana *</Label>
                  <Select value={form.manzana} onValueChange={(v) => f('manzana', v ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Manzana" /></SelectTrigger>
                    <SelectContent>{manzanasFiltradas.map((m) => <SelectItem key={m.codigo} value={m.codigo}>{m.codigo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 grid gap-1.5">
                  <Label>Código del Lote *</Label>
                  <Input
                    value={form.codigo}
                    onChange={(e) => f('codigo', e.target.value)}
                    placeholder="Ej: 001, L-01, A1..."
                    disabled={!!editTarget}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Datos Generales */}
            <TabsContent value="datos" className="mt-4 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Moneda</Label>
                  <Select value={form.moneda} onValueChange={(v) => f('moneda', v ?? 'GTQ')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MONEDAS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label>Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor}
                    onChange={(e) => f('valor', Number(e.target.value))}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>Extensión</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.extension}
                    onChange={(e) => f('extension', Number(e.target.value))}
                  />
                </div>

                <div className="col-span-2"><Separator /></div>

                <div className="grid gap-1.5">
                  <Label>Finca</Label>
                  <Input value={form.finca} onChange={(e) => f('finca', e.target.value)} placeholder="No. de finca" />
                </div>

                <div className="grid gap-1.5">
                  <Label>Folio</Label>
                  <Input value={form.folio} onChange={(e) => f('folio', e.target.value)} placeholder="No. de folio" />
                </div>

                <div className="grid gap-1.5">
                  <Label>Libro</Label>
                  <Input value={form.libro} onChange={(e) => f('libro', e.target.value)} placeholder="No. de libro" />
                </div>
              </div>
            </TabsContent>

            {/* Colindancias */}
            <TabsContent value="colindancias" className="mt-4 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Norte</Label>
                  <Input value={form.norte} onChange={(e) => f('norte', e.target.value)} placeholder="Colindancia al norte" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Sur</Label>
                  <Input value={form.sur} onChange={(e) => f('sur', e.target.value)} placeholder="Colindancia al sur" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Este</Label>
                  <Input value={form.este} onChange={(e) => f('este', e.target.value)} placeholder="Colindancia al este" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Oeste</Label>
                  <Input value={form.oeste} onChange={(e) => f('oeste', e.target.value)} placeholder="Colindancia al oeste" />
                </div>
                <div className="col-span-2 grid gap-1.5">
                  <Label>Otras colindancias</Label>
                  <Input value={form.otro} onChange={(e) => f('otro', e.target.value)} placeholder="Otras colindancias relevantes" />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isPending}>{isPending ? 'Guardando…' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lote?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el lote <strong>{deleteTarget?.codigo}</strong> de la manzana <strong>{deleteTarget?.manzana}</strong>. Acción irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
