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

**Regla por defecto:** usar `(v: string) => v ? (...) : null`. Aplica a la mayoría de `<Select>`: FK cargados de BD, hardcoded, y monedas. Ver excepción abajo.

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

### 2b. Selects dentro de grids con template literal (`grid-cols-[...]`) — trampa del `min-width: auto`

`className="w-full"` en el trigger es **necesario pero no suficiente** cuando el Select está en un grid con template literal custom.

**Por qué:** los grids numerados de Tailwind (`grid-cols-3`, etc.) generan `repeat(N, minmax(0, 1fr))` — tracks con mínimo **0**. Los grids con template literal (`grid-cols-[2fr_1fr_1fr]`, etc.) generan tracks con mínimo **`auto`**, que CSS calcula como el tamaño de contenido mínimo. El `whitespace-nowrap` del `SelectTrigger` (y de los `Label` con `tracking-wider`) hace que ese mínimo sea el ancho del texto más largo. Al cambiar la opción seleccionada ("Todos Los Dias" → "Un Mes"), el mínimo del track cambia y el grid se recalcula → el trigger "salta" de ancho aunque tenga `w-full`.

**Fix obligatorio:** agregar `[&>*]:min-w-0` al contenedor del grid para forzar `min-width: 0` en todos los grid items.

```tsx
// ✅ CORRECTO — el grid no crece/encoge según el texto seleccionado
<div className="col-span-2 grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-3 [&>*]:min-w-0">
  <div className="grid gap-1.5">
    <Label>Campo</Label>
    <Select ...>
      <SelectTrigger variant="underline" className="w-full">...</SelectTrigger>
    </Select>
  </div>
</div>

// ❌ INCORRECTO — el ancho del trigger cambia al seleccionar opciones de distinto largo
<div className="col-span-2 grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-3">
  ...
</div>
```

**Regla:** siempre que uses `grid-cols-[...]` (template literal con valores `fr` custom) y el grid contenga Selects o Inputs con Labels `whitespace-nowrap`, agregar `[&>*]:min-w-0` al grid. No aplica a `grid-cols-{n}` numerados porque ya incluyen `minmax(0, 1fr)`.

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
