'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Plus, Grid3x3, Search } from 'lucide-react'
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
import { createManzana, updateManzana, deleteManzana } from '@/app/actions/manzanas'
import type { Empresa, Proyecto, Fase, Manzana, ManzanaForm } from '@/lib/types/proyectos'

const EMPTY_FORM: ManzanaForm = {
  empresa: 0,
  proyecto: 0,
  fase: 0,
  codigo: '',
}

export function ManzanasClient({
  initialData,
  empresas,
  proyectos,
  fases,
}: {
  initialData: Manzana[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  fases: Fase[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Manzana | null>(null)
  const [editTarget, setEditTarget] = useState<Manzana | null>(null)
  const [form, setForm] = useState<ManzanaForm>(EMPTY_FORM)

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

  const filtered = initialData.filter(
    (m) =>
      m.codigo.toLowerCase().includes(search.toLowerCase()) ||
      (empresaMap.get(m.empresa) ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditTarget(null)
    const firstEmpresa = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)?.codigo ?? 0
    const firstFase = fases.find((f) => f.empresa === firstEmpresa && f.proyecto === firstProyecto)?.codigo ?? 0
    setForm({ empresa: firstEmpresa, proyecto: firstProyecto, fase: firstFase, codigo: '' })
    setDialogOpen(true)
  }

  function openEdit(m: Manzana) {
    setEditTarget(m)
    setForm({ empresa: m.empresa, proyecto: m.proyecto, fase: m.fase, codigo: m.codigo })
    setDialogOpen(true)
  }

  function f(key: keyof ManzanaForm, value: string | number) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'empresa') {
        const firstP = proyectos.find((p) => p.empresa === Number(value))
        next.proyecto = firstP?.codigo ?? 0
        const firstF = fases.find((f) => f.empresa === Number(value) && f.proyecto === next.proyecto)
        next.fase = firstF?.codigo ?? 0
      }
      if (key === 'proyecto') {
        const firstF = fases.find((f2) => f2.empresa === prev.empresa && f2.proyecto === Number(value))
        next.fase = firstF?.codigo ?? 0
      }
      return next
    })
  }

  function handleSave() {
    if (!form.codigo.trim()) { toast.error('El código es requerido.'); return }
    if (!form.empresa) { toast.error('Selecciona empresa.'); return }
    if (!form.proyecto) { toast.error('Selecciona proyecto.'); return }
    if (!form.fase) { toast.error('Selecciona fase.'); return }
    startTransition(async () => {
      const result = editTarget
        ? await updateManzana(editTarget.empresa, editTarget.proyecto, editTarget.fase, editTarget.codigo, form)
        : await createManzana(form)
      if (result.error) toast.error(result.error)
      else {
        toast.success(editTarget ? 'Manzana actualizada.' : 'Manzana creada.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteManzana(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.fase, deleteTarget.codigo)
      if (result.error) toast.error(result.error)
      else { toast.success('Manzana eliminada.'); router.refresh() }
      setDeleteTarget(null)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-orange-100 p-2.5">
            <Grid3x3 className="h-5 w-5 text-orange-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Manzanas</h1>
            <p className="text-sm text-muted-foreground">Administra las manzanas dentro de las fases</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2" disabled={fases.length === 0}>
          <Plus className="h-4 w-4" />
          Nueva Manzana
        </Button>
      </div>

      {fases.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Primero crea fases antes de agregar manzanas.
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar manzanas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Código</TableHead>
              <TableHead className="hidden md:table-cell">Empresa</TableHead>
              <TableHead className="hidden md:table-cell">Proyecto</TableHead>
              <TableHead className="hidden lg:table-cell">Fase</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center text-muted-foreground">
                  {search ? 'Sin resultados.' : 'No hay manzanas registradas aún.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={`${m.empresa}-${m.proyecto}-${m.fase}-${m.codigo}`} className="group">
                  <TableCell className="font-medium">{m.codigo}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {empresaMap.get(m.empresa) ?? `#${m.empresa}`}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {proyectoMap.get(m.proyecto) ?? `#${m.proyecto}`}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {faseMap.get(m.fase) ?? `#${m.fase}`}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground group-hover:opacity-100 focus-visible:outline-none"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(m)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(m)}>
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
        <DialogContent className="flex flex-col max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar Manzana' : 'Nueva Manzana'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 grid gap-1.5">
                <Label>Empresa *</Label>
                <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
                  <SelectContent>{empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="col-span-2 grid gap-1.5">
                <Label>Proyecto *</Label>
                <Select value={String(form.proyecto)} onValueChange={(v) => f('proyecto', Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona proyecto" /></SelectTrigger>
                  <SelectContent>{proyectosFiltrados.map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="col-span-2 grid gap-1.5">
                <Label>Fase *</Label>
                <Select value={String(form.fase)} onValueChange={(v) => f('fase', Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona fase" /></SelectTrigger>
                  <SelectContent>{fasesFiltradas.map((f2) => <SelectItem key={f2.codigo} value={String(f2.codigo)}>{f2.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="col-span-2 grid gap-1.5">
                <Label>Código *</Label>
                <Input
                  value={form.codigo}
                  onChange={(e) => f('codigo', e.target.value)}
                  placeholder="Ej: A, B, C, 1, 2..."
                  disabled={!!editTarget}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isPending}>{isPending ? 'Guardando…' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar manzana?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la manzana <strong>{deleteTarget?.codigo}</strong>. Esta acción es irreversible.
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
