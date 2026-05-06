---
description: "Cartera — Seguridad y validación para carga de imágenes (logos, fotos). Carga cuando la spec incluya un campo de tipo imagen (logo_url u otro) o cuando se implemente/modifique una Server Action de upload."
applyTo: "src/app/actions/*.ts, src/app/dashboard/**/_client.tsx"
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
  const path = `${cuenta}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

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
