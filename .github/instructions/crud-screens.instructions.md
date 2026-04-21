---
description: "Cartera  CRUD modal and form patterns: DialogContent layout, header gradient, icon badge modes, ViewField, SectionDivider, view/edit grids, delete dialog, audit log."
applyTo: "src/app/dashboard/**/_client.tsx"
---

# Cartera  Modal & Form Patterns

## File structure

```
page.tsx     Server Component: fetch with per-call .catch(() => [])
_client.tsx  Client Component: all UI, state, mutations
```

Mutations in `src/app/actions/<entity>.ts`. After mutations: `router.refresh()`.

---

## Modal layout

```tsx
<Dialog modal={false} open={dialogOpen} onOpenChange={(open) => {
  setDialogOpen(open)
  if (!open) { setIsEditing(false); if (hadConflict) { setHadConflict(false); router.refresh() } }
}}>
  <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">

    <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-{accent}-50/70 to-transparent border-b border-border/50 shrink-0">
      <div className="flex items-center gap-3 pr-8">
        <div className={`shrink-0 rounded-xl p-2 ${iconBadgeBg}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <DialogTitle className="text-base font-semibold leading-tight truncate">
            {isEditing && !viewTarget ? 'Nueva X' : isEditing ? 'Editar X' : viewTarget?.nombre}
          </DialogTitle>
          {viewTarget && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {subtitle}
              <span className="font-mono ml-1.5 text-muted-foreground/60"> #{viewTarget.codigo}</span>
            </p>
          )}
        </div>
      </div>
    </DialogHeader>

    <Tabs defaultValue="general" className="mt-2 flex flex-col flex-1 min-h-0">
      <TabsList className="shrink-0"><TabsTrigger value="general" className="gap-1.5"><MapPin className="h-3.5 w-3.5" /> General</TabsTrigger></TabsList>
      <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        {!isEditing && viewTarget ? <ViewMode /> : <EditMode />}
      </TabsContent>
    </Tabs>

    <DialogFooter className="mt-4 shrink-0">
      {!isEditing && viewTarget ? (
        <>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
          {puedeModificar && <Button onClick={startEdit} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</Button>}
        </>
      ) : (
        <>
          <Button variant="outline" onClick={cancelEdit}>{viewTarget ? 'Volver' : 'Cancelar'}</Button>
          <Button onClick={handleSave} disabled={isPending}>{isPending ? 'Guardando' : 'Guardar'}</Button>
        </>
      )}
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Icon badge by mode

| Mode     | Background    | Icon color    |
|----------|---------------|---------------|
| Viewing  | `{accent}-100` | `{accent}-600` |
| Creating | `{accent}-100` | `{accent}-600` |
| Editing  | `amber-100`   | `amber-600`   |

Icon: entity icon when viewing, `<Plus>` when creating, `<Pencil>` when editing.

---

## ViewField

```tsx
function ViewField({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
      <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">{label}</span>
      <span className="block text-[13px] font-medium text-foreground">{value || ''}</span>
    </div>
  )
}
```

---

## SectionDivider

```tsx
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-2 flex items-center gap-2 pt-1">
      <div className="h-4 w-0.5 rounded-full bg-primary/40" />
      <span className="text-xs font-semibold uppercase tracking-wider text-primary">{label}</span>
      <div className="flex-1 border-t border-primary/30" />
    </div>
  )
}
```

---

## View mode grid

```tsx
<div className="grid grid-cols-2 gap-3">
  <SectionDivider label="SECCION" />
  <div className="col-span-2"><ViewField label="Nombre" value={...} /></div>
  <ViewField label="Campo A" value={...} />
  <ViewField label="Campo B" value={...} />
</div>
```

- `gap-3` between cards. Full-width: wrap in `<div className="col-span-2">`. Half-width: no wrapper.
- País: show flag + nombre in a custom div (see ui-conventions.instructions.md geo rules).
- Boolean: `<Checkbox checked={!!record.field} disabled />` inside a `rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5` card.
- Logo: `<img>` inside a `col-span-2` muted card.

---

## Edit mode grid

```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="col-span-2 grid gap-1">
    <Label htmlFor="campo" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Label *</Label>
    <Input id="campo" ... />
  </div>
</div>
```

- `gap-4` between fields, `gap-1` inside each field wrapper (label  input).
- All `<Label>`: `className="text-[11px] font-semibold tracking-wider text-muted-foreground"`.
- Geo cascade: use native `<select>` (not Shadcn `<Select>`) with class:
  `flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50`
- Phone fields: `<PhoneField>` from `@/components/ui/phone-field`. Import `DIAL_CODES` and `splitPhone` from the same file. Sync `tel1Iso`/`tel1Local` with form via `useEffect` placed **after** the `form` useState declaration.
- **Hardcoded Select fields**: When a `<Select>` has fixed options (not loaded from DB), define a `const` map or array above the component, use the **numeric code** as `value` in `<SelectItem>`, store the code in the form/DB, and display the label/description everywhere (edit mode `<SelectValue>`, view mode `<ViewField>`). Example:
  ```tsx
  // definition (outside component)
  const TIPO_ID_LABELS: Record<number, string> = { 0: 'NIT', 1: 'DPI', 2: 'Extranjero' }

  // edit mode
  <Select value={String(form.tipo_id)} onValueChange={(v) => f('tipo_id', Number(v))}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      {Object.entries(TIPO_ID_LABELS).map(([k, v]) => (
        <SelectItem key={k} value={k}>{v}</SelectItem>
      ))}
    </SelectContent>
  </Select>

  // view mode
  <ViewField label="Tipo ID" value={TIPO_ID_LABELS[viewTarget.tipo_id] ?? `#${viewTarget.tipo_id}`} />
  ```

---

## Delete dialog

```tsx
<AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Eliminar <entidad>?</AlertDialogTitle>
      <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente <strong>{deleteTarget?.nombre}</strong>.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Audit log dialog

```tsx
<AuditLogDialog
  open={!!auditTarget}
  onOpenChange={(o) => !o && setAuditTarget(null)}
  tabla="t_<entity>"
  cuenta={auditTarget.cuenta}
  codigo={auditTarget.codigo}
  titulo={auditTarget.nombre}
/>
```
