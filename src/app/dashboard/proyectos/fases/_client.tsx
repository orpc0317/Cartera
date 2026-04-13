'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Plus, Layers, Search } from 'lucide-react'
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
import { createFase, updateFase, deleteFase } from '@/app/actions/fases'
import type { Empresa, Proyecto, Fase, FaseForm } from '@/lib/types/proyectos'

const MEDIDAS = ['Varas', 'Metros cuadrados', 'm²', 'Hectáreas', 'Manzanas', 'Cuerdas', 'Caballerías']

const EMPTY_FORM: FaseForm = {
  empresa: 0,
  proyecto: 0,
  codigo: 0,
  nombre: '',
  medida: 'Varas',
}

export function FasesClient({
  initialData,
  empresas,
  proyectos,
}: {
  initialData: Fase[]
  empresas: Empresa[]
  proyectos: Proyecto[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Fase | null>(null)
  const [editTarget, setEditTarget] = useState<Fase | null>(null)
  const [form, setForm] = useState<FaseForm>(EMPTY_FORM)

  // Cliente-side filtered projects based on selected empresa
  const proyectosFiltrados = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa]
  )

  const empresaMap = useMemo(
    () => new Map(empresas.map((e) => [e.codigo, e.nombre])),
    [empresas]
  )
  const proyectoMap = useMemo(
    () => new Map(proyectos.map((p) => [p.codigo, p.nombre])),
    [proyectos]
  )

  const filtered = initialData.filter(
    (f) =>
      f.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (empresaMap.get(f.empresa) ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(f.codigo).includes(search)
  )

  function openCreate() {
    setEditTarget(null)
    const firstEmpresa = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)?.codigo ?? 0
    setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto })
    setDialogOpen(true)
  }

  function openEdit(fase: Fase) {
    setEditTarget(fase)
    setForm({
      empresa: fase.empresa,
      proyecto: fase.proyecto,
      codigo: fase.codigo,
      nombre: fase.nombre,
      medida: fase.medida ?? 'Varas',
    })
    setDialogOpen(true)
  }

  function f(key: keyof FaseForm, value: string | number) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      // Reset proyecto when empresa changes
      if (key === 'empresa') {
        const firstP = proyectos.find((p) => p.empresa === Number(value))
        next.proyecto = firstP?.codigo ?? 0
      }
      return next
    })
  }

  function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido.'); return }
    if (!form.empresa) { toast.error('Selecciona la empresa.'); return }
    if (!form.proyecto) { toast.error('Selecciona el proyecto.'); return }
    startTransition(async () => {
      const result = editTarget
        ? await updateFase(editTarget.empresa, editTarget.proyecto, editTarget.codigo, form)
        : await createFase(form)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(editTarget ? 'Fase actualizada.' : 'Fase creada.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteFase(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.codigo)
      if (result.error) toast.error(result.error)
      else { toast.success('Fase eliminada.'); router.refresh() }
      setDeleteTarget(null)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-2.5">
            <Layers className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Fases</h1>
            <p className="text-sm text-muted-foreground">Administra las fases de los proyectos</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2" disabled={proyectos.length === 0}>
          <Plus className="h-4 w-4" />
          Nueva Fase
        </Button>
      </div>

      {proyectos.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Primero crea proyectos antes de agregar fases.
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar fases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-20">Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden md:table-cell">Empresa</TableHead>
              <TableHead className="hidden md:table-cell">Proyecto</TableHead>
              <TableHead className="hidden lg:table-cell">Medida</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                  {search ? 'Sin resultados para esa búsqueda.' : 'No hay fases registradas aún.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((fase) => (
                <TableRow key={`${fase.empresa}-${fase.proyecto}-${fase.codigo}`} className="group">
                  <TableCell className="font-mono text-xs text-muted-foreground">#{fase.codigo}</TableCell>
                  <TableCell className="font-medium">{fase.nombre}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {empresaMap.get(fase.empresa) ?? `#${fase.empresa}`}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {proyectoMap.get(fase.proyecto) ?? `#${fase.proyecto}`}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{fase.medida}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground group-hover:opacity-100 focus-visible:outline-none"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(fase)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(fase)}>
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
            <DialogTitle>{editTarget ? 'Editar Fase' : 'Nueva Fase'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 grid gap-1.5">
                <Label>Empresa *</Label>
                <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 grid gap-1.5">
                <Label>Proyecto *</Label>
                <Select value={String(form.proyecto)} onValueChange={(v) => f('proyecto', Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona proyecto" /></SelectTrigger>
                  <SelectContent>
                    {proyectosFiltrados.map((p) => (
                      <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 grid gap-1.5">
                <Label>Nombre *</Label>
                <Input value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Ej: Fase 1, Etapa A..." />
              </div>

              <div className="col-span-2 grid gap-1.5">
                <Label>Unidad de Medida</Label>
                <Select value={form.medida} onValueChange={(v) => f('medida', v ?? '')}>  
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEDIDAS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <AlertDialogTitle>¿Eliminar fase?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.nombre}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
