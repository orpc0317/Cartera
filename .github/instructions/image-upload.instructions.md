---
description: "Cartera — Seguridad y validación para carga de imágenes (logos, fotos). Cargar únicamente cuando la pantalla incluya un campo de tipo imagen (logo_url u otro) o cuando se implemente/modifique una Server Action de upload."
---

# Cartera — Image Upload Security

## Tipos permitidos y magic bytes

| MIME type       | Ext   | Magic bytes (offset 0)                                                                 | Riesgo  |
|-----------------|-------|----------------------------------------------------------------------------------------|---------|
| `image/png`     | `.png` | `89 50 4E 47 0D 0A 1A 0A`                                                             | Bajo    |
| `image/jpeg`    | `.jpg` | `FF D8 FF`                                                                             | Bajo    |
| `image/webp`    | `.webp`| `52 49 46 46 ?? ?? ?? ?? 57 45 42 50` (RIFF\*\*\*\*WEBP, bytes 0-3 y 8-11)           | Bajo    |
| `image/svg+xml` | `.svg` | No aplica (XML texto) — ver **Nota SVG**                                               | Medio   |

> **Nota SVG — riesgo real pero mitigado en este contexto:**
> Un SVG puede contener `<script>`, atributos `on*` y URIs `javascript:`. En la aplicación Cartera los logos se muestran **exclusivamente dentro de `<img>`**, lo que impide la ejecución de JS (sandbox de imagen del navegador). El riesgo persiste si:
> - se abre el SVG directamente en una pestaña del navegador, o
> - se renderiza inline con `dangerouslySetInnerHTML` (PROHIBIDO).
>
> **Regla:** nunca usar `dangerouslySetInnerHTML` con contenido SVG de origen externo. Si en el futuro se necesita SVG inline, sanitizar primero con una librería server-side (ej. DOMPurify Node).

---

## Límites de tamaño y dimensiones

| Parámetro    | Valor          | Notas                          |
|--------------|----------------|--------------------------------|
| Tamaño máximo | 5 MB          | Aplicar en cliente Y servidor  |
| Dim. mínima  | 200 × 200 px   | Solo rásteres; omitir en SVG   |
| Dim. máxima  | 4 000 × 4 000 px | Solo rásteres; omitir en SVG |

---

## Función `verifyMagicBytes` (servidor)

Colocar en el mismo archivo de la Server Action, antes de la función de upload:

```ts
function verifyMagicBytes(buffer: Uint8Array, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/png':
      return (
        buffer[0] === 0x89 && buffer[1] === 0x50 &&
        buffer[2] === 0x4E && buffer[3] === 0x47
      )
    case 'image/jpeg':
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF
    case 'image/webp':
      return (
        buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
      )
    case 'image/svg+xml':
      return true   // SVG es texto; no tiene magic bytes fijos
    default:
      return false
  }
}
```

---

## Función `extractStoragePath` (servidor)

Extrae la ruta relativa al bucket desde una URL pública de Supabase Storage. Usar para eliminar el archivo anterior al reemplazarlo.

```ts
function extractStoragePath(publicUrl: string, bucket: string): string | null {
  try {
    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = publicUrl.indexOf(marker)
    return idx >= 0 ? decodeURIComponent(publicUrl.slice(idx + marker.length)) : null
  } catch { return null }
}
```

---

## Patrón de Server Action para upload

```ts
import { createAdminClient } from '@/lib/supabase/admin'
// getCuentaActiva se define localmente en el archivo de acciones (ver server-actions.instructions.md)

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const MAX_BYTES     = 5 * 1024 * 1024   // 5 MB
const BUCKET        = 'project-logos'   // nombre del bucket en Supabase Storage

export async function uploadProjectLogo(
  formData: FormData,
  oldUrl?: string,           // URL anterior para eliminar tras la subida exitosa
): Promise<{ url?: string; error?: string }> {
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Archivo no recibido.' }

  // 1. Validar MIME type contra lista blanca
  if (!ALLOWED_TYPES.includes(file.type))
    return { error: 'Formato no permitido. Use PNG, JPG, WebP o SVG.' }

  // 2. Validar tamaño
  if (file.size > MAX_BYTES)
    return { error: 'El archivo supera el tamaño máximo de 5 MB.' }

  // 3. Autenticación
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  // 4. Leer bytes
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // 5. Verificar magic bytes (el file.type puede ser falsificado desde el cliente)
  if (!verifyMagicBytes(buffer, file.type))
    return { error: 'El contenido del archivo no coincide con el tipo declarado.' }

  // 6. Generar nombre único — NUNCA usar el nombre original del usuario
  const ext  = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1]
  const path = `${cuenta}/${crypto.randomUUID()}.${ext}`

  const admin = createAdminClient()

  // 7. Subir con upsert: false (el nombre único garantiza no sobreescribir)
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (error) return { error: error.message }

  // 8. Eliminar archivo anterior (best-effort — no falla si no existe)
  if (oldUrl) {
    const oldPath = extractStoragePath(oldUrl, BUCKET)
    if (oldPath) await admin.storage.from(BUCKET).remove([oldPath]).catch(() => {})
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl }
}
```

---

## Patrón de validación en `_client.tsx`

```ts
const LOGO_ACCEPT    = 'image/png,image/jpeg,image/webp,image/svg+xml'
const LOGO_MAX_BYTES = 5 * 1024 * 1024
const LOGO_MIN_DIM   = 200
const LOGO_MAX_DIM   = 4000

async function validateLogoFile(file: File): Promise<string | null> {
  const allowed = LOGO_ACCEPT.split(',')
  if (!allowed.includes(file.type)) return 'Formato no permitido. Use PNG, JPG, WebP o SVG.'
  if (file.size > LOGO_MAX_BYTES)   return 'El archivo supera el tamaño máximo de 5 MB.'
  if (file.type === 'image/svg+xml') return null   // SVG: omitir validación de dimensiones
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (img.width  < LOGO_MIN_DIM || img.height < LOGO_MIN_DIM)
        resolve(`Dimensiones mínimas ${LOGO_MIN_DIM}×${LOGO_MIN_DIM}px. La imagen tiene ${img.width}×${img.height}px.`)
      else if (img.width > LOGO_MAX_DIM || img.height > LOGO_MAX_DIM)
        resolve(`Dimensiones máximas ${LOGO_MAX_DIM}×${LOGO_MAX_DIM}px. La imagen tiene ${img.width}×${img.height}px.`)
      else resolve(null)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve('No se pudo leer la imagen.') }
    img.src = url
  })
}
```

**Llamada al guardar** — pasar la URL almacenada actual para habilitar el cleanup:

```ts
// En doSave() o equivalente:
const up = await uploadProjectLogo(fd, viewTarget?.logo_url ?? undefined)
```

---

## Componente `LogoUploadField` — requisitos

- Acepta click Y drag-and-drop sobre la zona de upload.
- `<input type="file" accept={LOGO_ACCEPT} aria-label="Seleccionar logo" className="hidden" />`
- Llamar `validateLogoFile(file)` antes de `onFileSelect`. Si devuelve error: mostrarlo en el campo (no como toast); no llamar `onFileSelect`.
- Preview inmediato con `URL.createObjectURL(file)`. Revocar con `URL.revokeObjectURL(url)` al sustituir o al desmontar.
- Botones **Cambiar** y **Quitar** visibles solo cuando `!disabled`.
- Mostrar errores con `<AlertCircle>` bajo el control, no como toast global.
- No usar `dangerouslySetInnerHTML` para renderizar el SVG; solo `<img src={...}>`.

---

## Reglas de seguridad — resumen

| # | Regla | Dónde aplicar |
|---|-------|---------------|
| 1 | Lista blanca de MIME types | Cliente + Servidor |
| 2 | Límite de tamaño 5 MB | Cliente + Servidor |
| 3 | Verificación de magic bytes | **Solo servidor** |
| 4 | Nombre de archivo generado (no el del usuario) | Servidor |
| 5 | `upsert: false` en storage upload | Servidor |
| 6 | Eliminar archivo anterior al reemplazar (`oldUrl`) | Servidor |
| 7 | `<img>` para mostrar logos (nunca inline SVG crudo) | Cliente |
| 8 | No `dangerouslySetInnerHTML` con contenido SVG externo | Cliente |
| 9 | Bucket de storage: lectura pública, escritura solo via Server Action autenticada | Infraestructura |
| 10 | Dimensiones mínimas/máximas para rásteres | Cliente (UX) |

---

## AC · LogoUploadField — Carga de imagen / logo

Usar solo en pantallas que tengan un campo `logo_url`. Leer también `image-upload.instructions.md` para las reglas de seguridad de la Server Action.

### Imports adicionales

```ts
import { ImageIcon, AlertCircle } from 'lucide-react'
import { useCallback } from 'react'
import { uploadProjectLogo } from '@/app/actions/<entidad>'
```

### Constantes y `validateLogoFile` (module-level, antes del componente)

```ts
const LOGO_ACCEPT   = 'image/png,image/jpeg,image/webp,image/svg+xml'
const LOGO_MAX_BYTES = 5 * 1024 * 1024   // 5 MB
const LOGO_MIN_DIM  = 200
const LOGO_MAX_DIM  = 4000

async function validateLogoFile(file: File): Promise<string | null> {
  const allowed = LOGO_ACCEPT.split(',')
  if (!allowed.includes(file.type)) return 'Formato no permitido. Use PNG, JPG, WebP o SVG.'
  if (file.size > LOGO_MAX_BYTES) return 'El archivo supera el tamaño máximo de 5 MB.'
  if (file.type === 'image/svg+xml') return null // SVG: omitir verificación de dimensiones
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (img.width < LOGO_MIN_DIM || img.height < LOGO_MIN_DIM)
        resolve(`Dimensiones mínimas ${LOGO_MIN_DIM}×${LOGO_MIN_DIM}px. La imagen tiene ${img.width}×${img.height}px.`)
      else if (img.width > LOGO_MAX_DIM || img.height > LOGO_MAX_DIM)
        resolve(`Dimensiones máximas ${LOGO_MAX_DIM}×${LOGO_MAX_DIM}px. La imagen tiene ${img.width}×${img.height}px.`)
      else resolve(null)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve('No se pudo leer la imagen.') }
    img.src = url
  })
}
```

### Componente `LogoUploadField` (antes del componente principal)

```tsx
function LogoUploadField({
  displayUrl, fileName, onFileSelect, onRemove, error, disabled,
}: {
  displayUrl: string
  fileName: string
  onFileSelect: (file: File) => void
  onRemove: () => void
  error: string
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileSelect(file)
  }, [onFileSelect])

  return (
    <div className="space-y-1.5">
      <Label>Logo</Label>
      {displayUrl ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5">
          <img src={displayUrl} alt="Logo" className="h-14 w-14 shrink-0 rounded object-contain bg-white border border-border" />
          <div className="min-w-0 flex-1">
            {fileName && <p className="truncate text-xs font-medium">{fileName}</p>}
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP o SVG · máx. 5 MB · mín. {LOGO_MIN_DIM}×{LOGO_MIN_DIM}px</p>
          </div>
          {!disabled && (
            <div className="flex gap-1 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}
                className="h-7 px-2 text-xs">Cambiar</Button>
              <Button type="button" variant="ghost" size="sm" onClick={onRemove}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <span className="text-muted-foreground">Haz clic o arrastra una imagen</span>
          <span className="text-xs text-muted-foreground">PNG, JPG, WebP o SVG · máx. 5 MB · mín. {LOGO_MIN_DIM}×{LOGO_MIN_DIM}px</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={LOGO_ACCEPT} aria-label="Seleccionar logo" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = '' }} />
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
        </p>
      )}
    </div>
  )
}
```

### State en el componente principal

```ts
const [logoFile, setLogoFile]           = useState<File | null>(null)
const [logoPreviewUrl, setLogoPreviewUrl] = useState('')
const [logoError, setLogoError]         = useState('')
```

### Handlers (con `useCallback`)

```ts
const handleLogoSelect = useCallback(async (file: File) => {
  const err = await validateLogoFile(file)
  if (err) { setLogoError(err); return }
  setLogoError('')
  if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl)
  setLogoFile(file)
  setLogoPreviewUrl(URL.createObjectURL(file))
}, [logoPreviewUrl])

const handleLogoRemove = useCallback(() => {
  if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl)
  setLogoFile(null); setLogoPreviewUrl('')
  setLogoError('')
  setForm((prev) => ({ ...prev, logo_url: '' }))
}, [logoPreviewUrl])
```

### Reset en openCreate() / openView() / cancelEdit()

```ts
setLogoFile(null); setLogoPreviewUrl(''); setLogoError('')
```

### En doSave() — subir antes de la mutación

```ts
if (logoFile) {
  const fd = new FormData()
  fd.append('file', logoFile)
  const up = await upload<Entity>Logo(fd, viewTarget?.logo_url ?? undefined)
  if (up.error) { toast.error(up.error); return }
  payload = { ...payload, logo_url: up.url ?? '' }
}
```

### Uso en JSX (edit/create mode)

```tsx
<div className="col-span-2">
  <LogoUploadField
    displayUrl={logoPreviewUrl || form.logo_url || ''}
    fileName={logoFile?.name ?? ''}
    onFileSelect={handleLogoSelect}
    onRemove={handleLogoRemove}
    error={logoError}
    disabled={!isEditing}
  />
</div>
```

### Uso en JSX (view mode)

```tsx
{viewTarget.logo_url ? (
  <img
    src={viewTarget.logo_url}
    alt="Logo"
    className="h-20 w-20 rounded-lg object-contain border border-border bg-white"
  />
) : (
  <span className="text-sm text-muted-foreground">Sin logo</span>
)}
```

---
