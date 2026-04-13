'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Plus, FolderKanban, Search } from 'lucide-react'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  createProyecto, updateProyecto, deleteProyecto,
} from '@/app/actions/proyectos'
import type { Empresa, Proyecto, ProyectoForm } from '@/lib/types/proyectos'
import type { Pais, Departamento, Municipio } from '@/app/actions/geo'
import { CountrySelect } from '@/components/ui/country-select'

// ─── Helpers ───────────────────────────────────────────────────────────────

const EMPTY_FORM: ProyectoForm = {
  empresa: 0,
  codigo: 0,
  nombre: '',
  pais: '',
  departamento: '',
  municipio: '',
  direccion: '',
  codigo_postal: '',
  telefono1: '',
  telefono2: '',
  mora_automatica: 0,
  fijar_parametros_mora: 0,
  forma_mora: 1,
  interes_mora: 0,
  fijo_mora: 0,
  mora_enganche: 0,
  dias_gracia: 0,
  dias_afectos: 30,
  inicio_calculo_mora: '',
  calcular_mora_antes: 0,
  minimo_mora: 0,
  minimo_abono_capital: 0,
  inicio_abono_capital_estricto: '',
  promesa_vencida: 0,
}

// ─── Componente principal ──────────────────────────────────────────────────

export function ProyectosClient({
  initialData,
  empresas,
  paises,
  departamentos,
  municipios,
}: {
  initialData: Proyecto[]
  empresas: Empresa[]
  paises: Pais[]
  departamentos: Departamento[]
  municipios: Municipio[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Proyecto | null>(null)
  const [editTarget, setEditTarget] = useState<Proyecto | null>(null)
  const [form, setForm] = useState<ProyectoForm>(EMPTY_FORM)

  // Códigos para cascada (no van al form, solo filtran)
  const [paisCodigo, setPaisCodigo] = useState('')
  const [deptoCodigo, setDeptoCodigo] = useState('')

  const deptosFiltrados = departamentos.filter((d) => d.pais === paisCodigo)
  const municipiosFiltrados = municipios.filter(
    (m) => m.pais === paisCodigo && m.departamento === deptoCodigo
  )

  const empresaMap = useMemo(
    () => new Map(empresas.map((e) => [e.codigo, e.nombre])),
    [empresas]
  )

  const filtered = initialData.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (empresaMap.get(p.empresa) ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(p.codigo).includes(search)
  )

  function openCreate() {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM, empresa: empresas[0]?.codigo ?? 0 })
    setPaisCodigo('')
    setDeptoCodigo('')
    setDialogOpen(true)
  }

  function openEdit(proyecto: Proyecto) {
    setEditTarget(proyecto)
    const nombrePais = proyecto.pais ?? ''
    const nombreDepto = proyecto.departamento ?? ''
    const foundPais = paises.find((p) => p.nombre === nombrePais)
    const pCode = foundPais?.codigo ?? ''
    const foundDepto = departamentos.find((d) => d.pais === pCode && d.nombre === nombreDepto)
    const dCode = foundDepto?.codigo ?? ''
    setPaisCodigo(pCode)
    setDeptoCodigo(dCode)
    setForm({
      empresa: proyecto.empresa,
      codigo: proyecto.codigo,
      nombre: proyecto.nombre,
      pais: proyecto.pais ?? 'Guatemala',
      departamento: proyecto.departamento ?? '',
      municipio: proyecto.municipio ?? '',
      direccion: proyecto.direccion ?? '',
      codigo_postal: proyecto.codigo_postal ?? '',
      telefono1: proyecto.telefono1 ?? '',
      telefono2: proyecto.telefono2 ?? '',
      mora_automatica: proyecto.mora_automatica ?? 0,
      fijar_parametros_mora: proyecto.fijar_parametros_mora ?? 0,
      forma_mora: proyecto.forma_mora ?? 1,
      interes_mora: proyecto.interes_mora ?? 0,
      fijo_mora: proyecto.fijo_mora ?? 0,
      mora_enganche: proyecto.mora_enganche ?? 0,
      dias_gracia: proyecto.dias_gracia ?? 0,
      dias_afectos: proyecto.dias_afectos ?? 30,
      inicio_calculo_mora: proyecto.inicio_calculo_mora ?? '',
      calcular_mora_antes: proyecto.calcular_mora_antes ?? 0,
      minimo_mora: proyecto.minimo_mora ?? 0,
      minimo_abono_capital: proyecto.minimo_abono_capital ?? 0,
      inicio_abono_capital_estricto: proyecto.inicio_abono_capital_estricto ?? '',
      promesa_vencida: proyecto.promesa_vencida ?? 0,
    })
    setDialogOpen(true)
  }

  function f(key: keyof ProyectoForm, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    if (!form.nombre.trim()) {
      toast.error('El nombre del proyecto es requerido.')
      return
    }
    if (!form.empresa) {
      toast.error('Debes seleccionar una empresa.')
      return
    }
    startTransition(async () => {
      const result = editTarget
        ? await updateProyecto(editTarget.empresa, editTarget.codigo, form)
        : await createProyecto(form)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(editTarget ? 'Proyecto actualizado.' : 'Proyecto creado.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteProyecto(deleteTarget.empresa, deleteTarget.codigo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Proyecto eliminado.')
        router.refresh()
      }
      setDeleteTarget(null)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-sky-100 p-2.5">
            <FolderKanban className="h-5 w-5 text-sky-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Proyectos</h1>
            <p className="text-sm text-muted-foreground">
              Administra los proyectos de lotificación
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2" disabled={empresas.length === 0}>
          <Plus className="h-4 w-4" />
          Nuevo Proyecto
        </Button>
      </div>

      {empresas.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Primero debes crear al menos una empresa antes de agregar proyectos.
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar proyectos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-20">Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden md:table-cell">Empresa</TableHead>
              <TableHead className="hidden lg:table-cell">País</TableHead>
              <TableHead className="hidden lg:table-cell">Departamento</TableHead>
              <TableHead className="hidden xl:table-cell">Municipio</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                  {search
                    ? 'No se encontraron proyectos con ese criterio.'
                    : 'Todavía no hay proyectos. Haz clic en "Nuevo Proyecto" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((proyecto) => (
                <TableRow key={`${proyecto.empresa}-${proyecto.codigo}`} className="group">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    #{proyecto.codigo}
                  </TableCell>
                  <TableCell className="font-medium">{proyecto.nombre}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {empresaMap.get(proyecto.empresa) ?? `Empresa #${proyecto.empresa}`}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {proyecto.pais || '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {proyecto.departamento || '—'}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground">
                    {proyecto.municipio || '—'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground group-hover:opacity-100 focus-visible:outline-none"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(proyecto)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(proyecto)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Eliminar
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex flex-col w-full max-w-2xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Editar Proyecto' : 'Nuevo Proyecto'}
            </DialogTitle>
          </DialogHeader>

            <Tabs defaultValue="general" className="mt-2 flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="mora">Parámetros de Mora</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 grid gap-1.5">
                  <Label htmlFor="empresa">Empresa *</Label>
                  <Select
                    value={String(form.empresa)}
                    onValueChange={(v) => f('empresa', Number(v))}
                  >
                    <SelectTrigger id="empresa">
                      <SelectValue placeholder="Selecciona una empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => (
                        <SelectItem key={e.codigo} value={String(e.codigo)}>
                          {e.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 grid gap-1.5">
                  <Label htmlFor="nombre">Nombre del Proyecto *</Label>
                  <Input
                    id="nombre"
                    value={form.nombre}
                    onChange={(e) => f('nombre', e.target.value)}
                    placeholder="Nombre del proyecto"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>País</Label>
                  <CountrySelect
                    paises={paises}
                    value={paisCodigo}
                    onChange={(codigo, nombre) => {
                      setPaisCodigo(codigo)
                      setDeptoCodigo('')
                      setForm((prev) => ({ ...prev, pais: nombre, departamento: '', municipio: '' }))
                    }}
                  />
                </div>

                <div className="col-span-2 grid gap-1.5">
                  <Label htmlFor="direccion_p">Dirección</Label>
                  <Input
                    id="direccion_p"
                    value={form.direccion}
                    onChange={(e) => f('direccion', e.target.value)}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="departamento_p">Departamento</Label>
                  <select
                    id="departamento_p"
                    title="Departamento"
                    value={deptoCodigo}
                    disabled={!paisCodigo}
                    onChange={(e) => {
                      const v = e.target.value
                      const d = deptosFiltrados.find((x) => x.codigo === v)
                      setDeptoCodigo(v)
                      setForm((prev) => ({ ...prev, departamento: d?.nombre ?? '', municipio: '' }))
                    }}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">{paisCodigo ? 'Seleccionar departamento' : 'Primero selecciona un país'}</option>
                    {deptosFiltrados.map((d) => (
                      <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="municipio_p">Municipio</Label>
                  <select
                    id="municipio_p"
                    title="Municipio"
                    value={municipiosFiltrados.find((m) => m.nombre === form.municipio)?.codigo ?? ''}
                    disabled={!deptoCodigo}
                    onChange={(e) => {
                      const v = e.target.value
                      const m = municipiosFiltrados.find((x) => x.codigo === v)
                      setForm((prev) => ({ ...prev, municipio: m?.nombre ?? '' }))
                    }}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">{deptoCodigo ? 'Seleccionar municipio' : 'Primero selecciona un departamento'}</option>
                    {municipiosFiltrados.map((m) => (
                      <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="codigo_postal_p">Código Postal</Label>
                  <Input
                    id="codigo_postal_p"
                    value={form.codigo_postal}
                    onChange={(e) => f('codigo_postal', e.target.value)}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="telefono1">Teléfono 1</Label>
                  <Input
                    id="telefono1"
                    value={form.telefono1}
                    onChange={(e) => f('telefono1', e.target.value)}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="telefono2">Teléfono 2</Label>
                  <Input
                    id="telefono2"
                    value={form.telefono2}
                    onChange={(e) => f('telefono2', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mora" className="mt-4 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="dias_gracia">Días de Gracia</Label>
                  <Input
                    id="dias_gracia"
                    type="number"
                    value={form.dias_gracia}
                    onChange={(e) => f('dias_gracia', Number(e.target.value))}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="dias_afectos">Días Afectos</Label>
                  <Input
                    id="dias_afectos"
                    type="number"
                    value={form.dias_afectos}
                    onChange={(e) => f('dias_afectos', Number(e.target.value))}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="interes_mora">Interés de Mora (%)</Label>
                  <Input
                    id="interes_mora"
                    type="number"
                    step="0.01"
                    value={form.interes_mora}
                    onChange={(e) => f('interes_mora', Number(e.target.value))}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="fijo_mora">Mora Fija</Label>
                  <Input
                    id="fijo_mora"
                    type="number"
                    step="0.01"
                    value={form.fijo_mora}
                    onChange={(e) => f('fijo_mora', Number(e.target.value))}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="minimo_mora">Mora Mínima</Label>
                  <Input
                    id="minimo_mora"
                    type="number"
                    step="0.01"
                    value={form.minimo_mora}
                    onChange={(e) => f('minimo_mora', Number(e.target.value))}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="minimo_abono">Mínimo Abono Capital</Label>
                  <Input
                    id="minimo_abono"
                    type="number"
                    step="0.01"
                    value={form.minimo_abono_capital}
                    onChange={(e) => f('minimo_abono_capital', Number(e.target.value))}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="inicio_mora">Inicio Cálculo Mora</Label>
                  <Input
                    id="inicio_mora"
                    type="date"
                    value={form.inicio_calculo_mora}
                    onChange={(e) => f('inicio_calculo_mora', e.target.value)}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="inicio_capital">Inicio Abono Capital Estricto</Label>
                  <Input
                    id="inicio_capital"
                    type="date"
                    value={form.inicio_abono_capital_estricto}
                    onChange={(e) => f('inicio_abono_capital_estricto', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente{' '}
              <strong>{deleteTarget?.nombre}</strong>. Esta operación no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
