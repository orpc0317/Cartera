# Snippets — modal

Copia la sección verbatim y reemplaza los placeholders `<angle-bracket>`. No inventes otra variante del control. El patrón de pantalla (`.cursor/rules/patterns.mdc`) define el layout y no cambia cómo se ve un Input, un Select o un Checkbox. Si el control no está en estas secciones, detente y pregunta.

Cursor no inyecta este archivo. Ábrelo cuando el skill `crud-screen` lo nombre.

Secciones: A, B, C, K, L, R, AF, AG.

## A · Modal — State declarations

Declare inside the component, after `colPrefs` state. Import `useCampoInvalido` from `@/lib/campo-invalido`.

```ts
const [dialogOpen, setDialogOpen]         = useState(false)
const [isEditing, setIsEditing]           = useState(false)
const [viewTarget, setViewTarget]         = useState<<Entity> | null>(null)
const [form, setForm]                     = useState<<EntityForm>>(EMPTY_FORM)
const [isPending, startTransition]        = useTransition()
const { activeTab, setActiveTab, campoInvalido, rechazar, limpiarCampoInvalido } = useCampoInvalido()
const [hadConflict, setHadConflict]       = useState(false)
const [similarWarning, setSimilarWarning] = useState<string[]>([])  // names of potential duplicates; non-empty = AlertDialog open
const [deleteTarget, setDeleteTarget]     = useState<<Entity> | null>(null)
const [auditTarget, setAuditTarget]       = useState<<Entity> | null>(null)  // full row object; !!auditTarget controls dialog open
```

---


## B · Modal — Computed values (place right after state declarations)

```ts
// Icon badge: amber when editing an existing record; accent for all other modes
const iconBadgeBg  = isEditing && viewTarget ? 'bg-amber-100'   : 'bg-<accent>-100'
const iconBadgeClr = isEditing && viewTarget ? 'text-amber-600' : 'text-<accent>-600'
const icon = !isEditing
  ? <<EntityIcon> className={`h-4 w-4 ${iconBadgeClr}`} />          // viewing
  : !viewTarget
    ? <Plus   className={`h-4 w-4 ${iconBadgeClr}`} />              // creating
    : <Pencil className={`h-4 w-4 ${iconBadgeClr}`} />              // editing

// El título del modal es el nombre del menú. No hay subtítulo de proyecto ni código.
```

---


## C · Modal — Functions

Copy all five. In `startEdit` list every `<EntityForm>` field. Replace `create<Entity>` / `update<Entity>` with the actual action import names (convención: `createBanco`, `updateBanco`, `deleteBanco` — camelCase `create/update/delete` + PascalCase entity, importados desde `@/app/actions/<entity-kebab>.ts`).

`openView` sigue asignando la fila de la tabla para pintar de inmediato. Además, toda pantalla con modal Ver relee solo ese registro. El alta (`viewTarget === null`) no dispara la lectura. No uses `router.refresh()` al abrir.

```ts
import { obtener<Entity> } from '@/app/actions/<entity-kebab>'
import { nombreLeido, reemplazarFila, type NombresVer } from '@/lib/registro-ver'
import { useFilas, useRegistroVer } from '@/lib/use-registro-ver'

const [filas, setFilas] = useFilas(initialData)
const [viewTarget, setViewTarget] = useState<(<Entity> & NombresVer) | null>(null)

const claveVer = dialogOpen && viewTarget
  ? `${viewTarget.empresa}-${viewTarget.proyecto}-${viewTarget.codigo}`
  : null
const { lecturaPendiente } = useRegistroVer({
  activo: dialogOpen && viewTarget != null,
  clave: claveVer,
  editando: isEditing,
  leer: () => viewTarget
    ? obtener<Entity>(viewTarget.empresa, viewTarget.proyecto, viewTarget.codigo)
    : Promise.resolve({ error: 'Registro no encontrado.' }),
  alLlegar: (row, editando) => {
    setFilas((prev) => reemplazarFila(prev, (r) => `${r.empresa}-${r.proyecto}-${r.codigo}`, row))
    if (editando) {
      setViewTarget((prev) => prev ? { ...prev, modifico_fecha: row.modifico_fecha } : row)
      return
    }
    setViewTarget(row)
    setForm(/* the same rebuild openView uses */)
  },
})
```

Usa `filas` en la tabla. La clave repite la PK de la entidad. Editar lleva `disabled={lecturaPendiente}`: sigue deshabilitado si la lectura falla, para no grabar con un `modifico_fecha` viejo. El nombre visible de una referencia sale de la lectura: `nombreLeido(viewTarget.empresa_nombre, empresaMap.get(viewTarget.empresa) ?? '')`. Una pestaña que ya consulta su detalle por id puede seguir haciéndolo; la cabecera y los nombres no quedan exentos. `server-actions.mdc` define `obtener<Entity>`.

```ts
function openCreate() {
  limpiarCampoInvalido()
  setActiveTab('general')
  // Pre-select first item for every dropdown in the form (cascade order)
  const firstEmpresa  = empresas[0]?.codigo ?? 0
  const firstProyecto = proyectos.filter((p) => p.empresa === firstEmpresa)[0]?.codigo ?? 0
  setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto })
  setViewTarget(null)
  setIsEditing(true)
  setDialogOpen(true)
}

function openView(row: <Entity>) {
  limpiarCampoInvalido()
  setActiveTab('general')
  setViewTarget(row)
  setIsEditing(false)
  setDialogOpen(true)
}

function startEdit() {
  limpiarCampoInvalido()
  setActiveTab('general')
  setForm({
    // List every field in <EntityForm> — copy EMPTY_FORM keys, source values from viewTarget
    campo1: viewTarget!.campo1,
    campo2: viewTarget!.campo2,
    // ...
  })
  setIsEditing(true)
}

function cancelEdit() {
  limpiarCampoInvalido()
  if (viewTarget) setIsEditing(false)  // return to view mode — form re-populated on next startEdit()
  else            setDialogOpen(false) // was creating — close dialog
}

function handleSave() {
  // Campo inválido: rechazar marca, enfoca y deja el mensaje bajo el campo. Ver crud-screens.mdc § Campo con error al grabar.
  if (!String(form.campo1 ?? '').trim()) { rechazar('campo1', '<mensaje de la pantalla>'); return }
  // Sin cambios: igual que Cancelar. Volver a Ver, sin request.
  if (viewTarget && JSON.stringify(form) === JSON.stringify(buildFormFrom<Entity>(viewTarget))) {
    cancelEdit(); return
  }
  const editing = viewTarget
  startTransition(async () => {
    const lastModified = editing?.modifico_fecha ?? undefined
    if (editing) {
      const result = await update<Entity>(editing.codigo, form, lastModified)
      if (result.error) {
        toast.error(result.error)
        if (result.error.includes('modificado')) setHadConflict(true)
        return
      }
      // La fila del servidor trae modifico_fecha nuevo. Sin ella, el siguiente guardado choca consigo mismo.
      // Rama separada del alta: el tipo de create no tiene `row` y TypeScript no lo estrecha en un ternario.
      if (!result.row) { toast.error('No se pudo recargar el registro.'); return }
      setHadConflict(false)
      setViewTarget(result.row)
      setForm(buildFormFrom<Entity>(result.row))
      setIsEditing(false)
      toast.success('<Entidad> actualizada.')
      router.refresh()
      return
    }
    const result = await create<Entity>(form)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setHadConflict(false)
    toast.success('<Entidad> creada.')
    setDialogOpen(false)
    router.refresh()
  })
}
```

> **Campo con error:** importa `useCampoInvalido` desde `@/lib/campo-invalido` y `MensajeCampo` desde `@/components/ui/mensaje-campo`. Un error de campo llama `rechazar` y hace `return` antes de `startTransition`. El mensaje va en rojo bajo el campo. `toast.error(result.error)` queda para la respuesta del servidor. La regla completa está en `.cursor/rules/crud-screens.mdc` § Campo con error al grabar.

> **Cascade in `openCreate`:** when the form has chained dropdowns (empresa → proyecto → fase), compute each first value from the filtered downstream list, in cascade order, and pass all of them to `setForm`.

> **Dirty check (obligatorio en todo `handleSave`):** si `viewTarget` existe, comparar `form` contra el original antes de llamar al servidor. Si no hay cambios, volver a Ver con `cancelEdit()`. No cerrar el modal.
>
> ```ts
> // Con buildFormFromX:
> if (viewTarget && JSON.stringify(form) === JSON.stringify(buildFormFrom<Entity>(viewTarget))) {
>   cancelEdit(); return
> }
> // Con geo (buildFormFromX retorna { form, paisCodigo, ... }):
> if (viewTarget && JSON.stringify(form) === JSON.stringify(buildFormFrom<Entity>(viewTarget).form)) {
>   cancelEdit(); return
> }
> ```
> — Sin `buildFormFromX`: comparar campo a campo con `viewTarget` respetando `?? null` / `?? ''`.
> — Con campo `logoFile`: añadir `&& !logoFile` a la condición.
>
> **Tras un update exitoso:** `update*` devuelve `{ row }`. Asignar `setViewTarget(result.row)`, rearmar el formulario con la misma función que `openView` (geo, teléfonos, strings numéricos) y `setIsEditing(false)`. El diálogo sigue abierto. `router.refresh()` actualiza la tabla. El alta (`viewTarget` null) sí hace `setDialogOpen(false)`.

---


## K · AlertDialog — Delete confirmation

State: `const [deleteTarget, setDeleteTarget] = useState<<Entity> | null>(null)` (already in block A).

```tsx
<AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
  <AlertDialogContent>
    <AlertDialogTitle>¿Eliminar <entidad>?</AlertDialogTitle>
    <AlertDialogDescription render={<div />}>
      <div>
        Esta acción es permanente. ¿Eliminar <strong>{deleteTarget?.<nombre>}</strong>?
      </div>
    </AlertDialogDescription>
    <AlertDialogFooter>
      <AlertDialogCancel render={<Button variant="outline" />}>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        render={<Button variant="destructive" />}
        onClick={async () => {
          if (!deleteTarget) return
          const result = await delete<Entity>(deleteTarget.codigo)
          if (result.error) toast.error(result.error)
          else { toast.success('<Entidad> eliminada.'); router.refresh() }
          setDeleteTarget(null)
        }}
      >
        Eliminar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

> **`render={<div />}` is mandatory** — Base UI does not support `asChild` on `AlertDialogDescription`. Nesting `<p>` inside causes a hydration error.

---


## L · Row action button (Ver)

**Estándar 2026-08 — reemplaza el dropdown de acciones por fila.** La columna de acción de la tabla
muestra **únicamente** el botón "Ver" — sin dropdown, sin chevron, sin `MoreHorizontal` — porque es la
única acción de la fila. Editar, Historial, Eliminar y cualquier acción adicional propia de la entidad
(ej. Plan Pagos, Anular) viven ahora dentro del **footer del modal Ver** como un grupo de botones —
ver § R. Pantalla de referencia: `promesas/promesas/_client.tsx`.

```tsx
<button
  type="button"
  onClick={() => openView(row)}
  title={puedeModificar ? 'Ver / Editar' : 'Ver'}
  className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
>
  <Eye className="h-4 w-4" />
</button>
```

> **Ya no se usa `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`/`MoreHorizontal`
> en la columna de acción de la fila.** Si el archivo no usa `DropdownMenu` en ningún otro lugar, elimina
> ese import junto con `MoreHorizontal`.

---


## R · Modal JSX completo

```tsx
{/* ── State, computed vars, funciones ── ver § A, B, C antes de este JSX ── */}

<Dialog modal={false} open={dialogOpen} onOpenChange={(open) => {
  // Guard: no cerrar el modal Ver mientras haya un dialog anidado abierto desde el footer
  // (Historial, Eliminar, o cualquier acción extra de la entidad) — ver .cursor/rules/base-ui-gotchas.mdc § 5
  if (!open && (similarWarning.length > 0 || deleteTarget !== null || auditTarget !== null)) return
  setDialogOpen(open)
  if (!open) { setIsEditing(false); if (hadConflict) { setHadConflict(false); router.refresh() } }
}}>
  <DialogContent className={`flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden ${FONDO_MODAL}`}>

    <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-2 bg-gradient-to-br from-<accent>-50/70 to-transparent border-b border-border/50 shrink-0">
      <div className="flex items-center gap-3 pr-8">
        <div className={`shrink-0 rounded-xl p-2 ${iconBadgeBg}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <DialogTitle className="text-base font-semibold leading-tight truncate">
            <Nombre del menú>
          </DialogTitle>
        </div>
      </div>
    </DialogHeader>

    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-0.5 flex flex-col flex-1 min-h-0">
      <div className={`-mx-4 -mt-4 shrink-0 border-b px-4 py-2 ${FRANJA_BLANCA}`}>
        <TabsList variant="line" className="bg-transparent">
          <TabsTrigger value="general" className={CLASE_PESTANA_MODAL}>
            <MapPin className="h-3.5 w-3.5" /> General
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="general" className="mt-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
        {!isEditing && viewTarget ? (
          /* ── View mode — § O ── */
          <div className="grid grid-cols-2 gap-2">
            <SegmentCard label="SECCION">
              {/* ViewField blocks de esta sección */}
            </SegmentCard>
          </div>
        ) : (
          /* ── Edit mode — § P ── */
          <div className="grid grid-cols-2 gap-2">
            <SegmentCard label="SECCION">
              {/* form fields de esta sección */}
            </SegmentCard>
          </div>
        )}
      </TabsContent>
    </Tabs>

    {/* Estándar 2026-08 — footer consolidado: sin botón "Cerrar" (la "x" del header ya cierra).
        Historial + Eliminar (+ acciones extra de la entidad, ej. Plan Pagos/Anular) y Editar
        quedan agrupados en una sola fila con variant="ghost", en el mismo orden mostrado abajo.
        El footer tiene TRES ramas: Ver / Editar (existente) / Nuevo (crear) — ver § siguiente. */}
    <DialogFooter className={`mt-4 shrink-0 ${FRANJA_BLANCA}`}>
      {!isEditing && viewTarget ? (
        /* ── Ver ── */
        <div className="flex w-full items-center gap-1">
          <Button variant="ghost" size="sm" className={CLASE_BOTON_MODAL} onClick={() => setAuditTarget(viewTarget)}>
            <History className="mr-1.5 h-3.5 w-3.5" /> Historial
          </Button>
          {/* acciones extra de la entidad (ej. Plan Pagos, Anular) van aquí, mismo variant="ghost" +
              mismo hover de acento si es una acción neutra; las de advertencia/peligro (Anular,
              Desistir) conservan su propio color de texto y NO llevan el hover de acento */}
          {puedeEliminar && (
            <Button variant="ghost" size="sm" className={CLASE_BOTON_PELIGRO} onClick={() => setDeleteTarget(viewTarget)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eliminar
            </Button>
          )}
          {puedeModificar && (
            <Button variant="ghost" size="sm" className={CLASE_BOTON_MODAL} onClick={startEdit} disabled={lecturaPendiente}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
            </Button>
          )}
        </div>
      ) : viewTarget ? (
        /* ── Editar (registro existente) — Cancelar + Guardar, sin cambios ── */
        <div className="flex w-full justify-end gap-2">
          <Button variant="ghost" size="sm" className={CLASE_BOTON_MODAL} onClick={cancelEdit} disabled={isPending}>Cancelar</Button>
          <Button variant="ghost" size="sm" className={CLASE_BOTON_MODAL} onClick={handleSave} disabled={isPending}>{isPending ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      ) : (
        /* ── Nuevo (crear) — Estándar 2026-08: sin "Cancelar" (la "x" del header ya cierra),
            Guardar como ghost button alineado a la derecha, mismo estilo que el footer Ver. */
        <div className="flex w-full justify-end">
          <Button variant="ghost" size="sm" className={CLASE_BOTON_MODAL} onClick={handleSave} disabled={isPending}>
            <Check className="mr-1.5 h-3.5 w-3.5" /> {isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      )}
    </DialogFooter>
  </DialogContent>
</Dialog>
```

> Las clases salen de `@/lib/modal-look`: `FONDO_MODAL`, `FRANJA_BLANCA`, `CLASE_PESTANA_MODAL`, `CLASE_BOTON_MODAL`, `CLASE_BOTON_PELIGRO`, `CLASE_BOTON_CONFIRMAR`.
>
> El título del diálogo es el nombre del menú. No hay subtítulo de proyecto ni código. El icono del encabezado y el degradado de acento se conservan.
>
> **Orden fijo de botones en el footer (modo vista):** Historial → acciones extra de la entidad (si
> las hay) → Eliminar → Editar. Todos `variant="ghost" size="sm"` con `CLASE_BOTON_MODAL`.
> Eliminar y Desactivar del pie usan `CLASE_BOTON_PELIGRO`: gris rojizo y, al pasar, rojo, sin fondo.
> El confirmar de la baja es el botón rojo relleno, `CLASE_BOTON_CONFIRMAR`.
>
> **Footer modo Nuevo (crear) vs Editar (existente):** ambos usan `CLASE_BOTON_MODAL`.
> En **Editar** van Cancelar y Guardar. En **Nuevo** no hay Cancelar (la "x" del header cierra)
> y Guardar queda a la derecha, con el icono `Check`. Si la pantalla no tiene modo Editar, la rama de alta usa ese mismo patrón.



---


## AF · AuditLogDialog — Historial de cambios

Mostrar en **todas** las pantallas CRUD. Permite ver el historial completo de INSERT/UPDATE/DELETE de un registro.

> **Requisito del lado del servidor:** este botón solo funciona si la Server Action que crea/edita/elimina
> el registro llama a `writeAudit` — ver la regla obligatoria en `.cursor/rules/server-actions.mdc § writeAudit`
> (incluye el caso de creación vía función RPC `SECURITY DEFINER`, donde este paso se escapa fácil).

### Import

```ts
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
```

### State (ya está en §A)

```ts
const [auditTarget, setAuditTarget] = useState<<Entity> | null>(null)  // full row
```

### Botón en el footer del modal Ver (ya está en §L / §R)

```tsx
<Button variant="ghost" size="sm" onClick={() => setAuditTarget(viewTarget)}>
  <History className="mr-1.5 h-3.5 w-3.5" /> Historial
</Button>
```

### JSX del componente

Agregar **antes** del `</div>` de cierre del componente, después del AlertDialog de borrado:

```tsx
{/* ── Historial ── */}
{auditTarget && (
  <AuditLogDialog
    open={!!auditTarget}
    onOpenChange={(o) => !o && setAuditTarget(null)}
    tabla="<t_nombre_tabla>"
    cuenta={auditTarget.cuenta}
    registroId={<registroId>}
    titulo={auditTarget.nombre}
  />
)}
```

### Campo `registroId` según jerarquía de la entidad

Debe coincidir **exactamente** con lo que `writeAudit` almacena en la action de la entidad.

| Entidad | `registroId` |
|---------|-------------|
| Empresa | `{{ codigo: auditTarget.codigo }}` |
| Proyecto | `{{ empresa: auditTarget.empresa, codigo: auditTarget.codigo }}` |
| Fase, Banco, CuentaBancaria, TipoIngreso, Vendedor, Cobrador, Coordinador, Supervisor, Cliente | `{{ empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, codigo: auditTarget.codigo }}` |
| Manzana | `{{ empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, fase: auditTarget.fase, codigo: auditTarget.codigo }}` |
| Lote | `{{ empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, fase: auditTarget.fase, manzana: auditTarget.manzana, codigo: auditTarget.codigo }}` |
| SerieRecibo | `{{ empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, serie: auditTarget.serie }}` (campo `serie`, no `codigo`) |

> **REGLA:** el `registroId` debe incluir **todos** los campos que forman la clave primaria compuesta de la tabla — los mismos que la action almacena en `registro_id` de `t_audit_log`. Usar el operador `cs` (JSON containment) de PostgREST garantiza que no haya colisiones entre registros de diferentes proyectos que compartan el mismo `codigo`.

### `titulo` cuando no hay campo `nombre`

- `Manzana`: `titulo={\`Manzana ${auditTarget.codigo}\``}
- `Lote`: `titulo={auditTarget.codigo}`
- `SerieRecibo`: `titulo={\`Serie ${auditTarget.serie}\``}

---


## AG · Modal ancho — 2 columnas con separador vertical

Usar cuando el modal tiene **3 o más secciones**, o **12+ campos** en total, y una sola columna resultaría en una lista excesivamente larga. Primera pantalla validada: `lotes/_client.tsx`.

### Cuándo usar wide vs narrow

| Condición | Modal a usar |
|-----------|-------------|
| 1–2 secciones, ≤ 10 campos | Narrow `sm:max-w-[36rem]` — **§ R** |
| 3+ secciones, o ≥ 12 campos | Wide `sm:max-w-[64rem]` — **§ AG** |

### DialogContent

```tsx
<DialogContent className={`flex flex-col w-[90vw] sm:max-w-[64rem] h-[700px] max-h-[90vh] overflow-hidden ${FONDO_MODAL}`}>
```

### Contenedor de 2 columnas

Este `<div>` reemplaza el `<div className="grid grid-cols-2 gap-3">` estándar del § O / § P.  
Aplica **exactamente igual** en modo vista y en modo edición (solo cambia `gap-3` → `gap-4` en el inner grid de edición).

```tsx
<div className="flex gap-6 items-start">

  {/* Columna izquierda */}
  <div className="flex-1 grid grid-cols-2 gap-2">
    <SegmentCard label="SECCION A">
      {/* campos de la sección A */}
    </SegmentCard>
    <SegmentCard label="SECCION B">
      {/* campos de la sección B */}
    </SegmentCard>
  </div>

  {/* Separador vertical */}
  <div className="w-px self-stretch bg-primary/30" />

  {/* Columna derecha */}
  <div className="flex-1 grid grid-cols-2 gap-2">
    <SegmentCard label="SECCION C">
      {/* campos de la sección C */}
    </SegmentCard>
    <SegmentCard label="SECCION D">
      {/* campos de la sección D */}
    </SegmentCard>
  </div>

</div>
```

### Columna derecha vacía (reservada para contenido futuro)

Cuando una pestaña todavía no tiene contenido en la columna derecha, usar un `div` vacío para mantener la estructura simétrica:

```tsx
<div className="w-px self-stretch bg-primary/30" />
<div className="flex-1" />
```

### Reglas

- **`gap-6`** en el flex exterior — provee 24 px a cada lado del separador. No reducir.
- **`SegmentCard`** tiene `col-span-2` hardcodeado en su contenedor raíz → funciona correctamente dentro de `flex-1 grid grid-cols-2`.
- **Anchos de campo** dentro de cada columna: `(full)` = `col-span-2`, `(half)` = una celda, `(third)` = igual que el estándar (ver `.cursor/rules/crud-screens.mdc`). Las reglas no cambian respecto al modal estrecho.
- **Color del separador:** `bg-primary/30` — mismo tono que el acento del módulo. **No** usar colores de acento de módulo distintos.
- **Distribución de secciones:** máximo ~3 secciones por columna. Distribuir equilibrando la altura visual entre columnas izquierda y derecha.
- El `TabsContent` que envuelve este layout mantiene `className="mt-0 flex-1 overflow-y-auto overflow-x-hidden pr-1"` sin cambios.
