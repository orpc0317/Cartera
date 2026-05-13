---
description: "Base UI vs Radix/shadcn API differences that cause silent bugs in Cartera. Load alongside crud-screens.instructions.md for every _client.tsx."
applyTo: "src/app/dashboard/**/_client.tsx"
---

# Base UI — Diferencias críticas vs Radix / shadcn

Este proyecto usa **Base UI** (`@base-ui/react`), no Radix UI. Muchos patrones de Radix/shadcn documentados en internet **no funcionan aquí**. Esta lista cubre las trampas más comunes que causan bugs silenciosos.

---

## 1. `<SelectValue>` — render prop signature

**Base UI** pasa el valor seleccionado como **string directo** al hijo función.  
**Radix** pasa un objeto `{ value: string }`.

```tsx
// ✅ CORRECTO — Base UI
<SelectValue>
  {(v: string) => v ? (empresaMap.get(Number(v)) ?? v) : null}
</SelectValue>

// ❌ INCORRECTO — patrón Radix; `value` siempre es undefined en Base UI
<SelectValue>
  {({ value }: { value: string }) => empresaMap.get(Number(value)) ?? 'Selecciona'}
</SelectValue>

// ❌ INCORRECTO — hijo estático que lee form state directamente
<SelectValue>
  {empresaMap.get(form.empresa) ?? 'Selecciona empresa'}
</SelectValue>
```

**Regla:** usar siempre `(v: string) => v ? (...) : null`. Aplica a **todos** los `<Select>`: FK cargados de BD, hardcoded, y monedas.

**Excepción — quando el `codigo` ya ES el label de display** (e.g. `manzana`, `serie_recibo`, `serie_factura`): estas entidades no tienen campo `nombre` separado; el `codigo` es lo que se muestra. Para estos selects usar `<SelectValue />` limpio **sin render-prop**.

```tsx
// ✅ CORRECTO — codigo es el display label
<SelectValue placeholder="Selecciona serie" />

// ✅ CORRECTO — FK numérico que requiere lookup a nombre
<SelectValue placeholder="Selecciona banco">
  {(v: string) => v ? (bancoMap.get(Number(v)) ?? v) : null}
</SelectValue>
```

---

## 2. `<SelectTrigger>` — ancho

El componente base tiene `w-fit` por defecto. **Siempre** agregar `className="w-full"`.

```tsx
// ✅ CORRECTO
<SelectTrigger className="w-full">

// ❌ INCORRECTO — se encoge al texto seleccionado
<SelectTrigger>
```

Aplica a todos los selects en edit mode, sin importar si el campo es `full`, `half`, o `third`.

---

## 3. `<AlertDialogDescription>` — no soporta `asChild`

Base UI **no soporta** la prop `asChild` en `AlertDialogDescription`. Para cambiar el elemento raíz usar `render={<div />}`. Nunca anidar `<p>` dentro porque genera el error de hidratación `<p> cannot be a descendant of <p>`.

```tsx
// ✅ CORRECTO
<AlertDialogDescription render={<div />}>
  <div>¿Eliminar <strong>{target?.nombre}</strong>?</div>
</AlertDialogDescription>

// ❌ INCORRECTO — asChild no existe en Base UI
<AlertDialogDescription asChild>
  <div>...</div>
</AlertDialogDescription>
```

---

## 4. `<DropdownMenuTrigger>` — no soporta `asChild`

Usar `className` directamente en `<DropdownMenuTrigger>`, no envolver con `<Button asChild>`.

```tsx
// ✅ CORRECTO
<DropdownMenuTrigger className="...estilos de botón...">
  <MoreHorizontal />
</DropdownMenuTrigger>

// ❌ INCORRECTO — asChild no existe en Base UI
<DropdownMenuTrigger asChild>
  <Button variant="ghost">...</Button>
</DropdownMenuTrigger>
```

---

## 5. `<Dialog modal={false}>` — guard al cerrar

Con `modal={false}` el `onOpenChange` se dispara al hacer clic fuera. Si hay un `AlertDialog` activo (e.g. confirmación de similares o de eliminación), el dialog principal no debe cerrarse. Incluir siempre el guard:

```tsx
// similarWarning es string[] — declarado como useState<string[]>([])
// Non-empty = hay un AlertDialog de duplicados abierto
<Dialog modal={false} open={dialogOpen} onOpenChange={(open) => {
  if (!open && (similarWarning.length > 0 || deleteTarget !== null)) return  // guard
  setDialogOpen(open)
  if (!open) { setIsEditing(false); if (hadConflict) { setHadConflict(false); router.refresh() } }
}}>
```
