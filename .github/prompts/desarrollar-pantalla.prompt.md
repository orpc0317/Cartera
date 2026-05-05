---
mode: agent
description: "Construir o actualizar una pantalla CRUD en Cartera ERP. Invocar con el spec file adjunto, e.g. #file:prompts/crud-bancos.md"
---

# Desarrollar pantalla CRUD

Spec file adjunto: leerlo ahora con `read_file` antes de continuar.

---

## PASO 1 — MODO_GUARD (ejecutar ANTES de cualquier otra cosa)

1. Leer el spec file adjunto y extraer los campos `RUTA` y `MODO` de la sección `## IDENTIFICACION`.
2. Usar `file_search` para verificar si `src/app/dashboard/<RUTA>/page.tsx` ya existe en el repositorio.

**Si el archivo existe Y `MODO = nuevo`:**
> **DETENER. No generar ningún archivo.**
> Informar al desarrollador:
> "La pantalla **[NOMBRE]** ya existe en `src/app/dashboard/<RUTA>/page.tsx`.
> Tiene dos opciones:
> - Confirmar que desea **regenerarla desde cero** (se sobrescribirán los archivos existentes).
> - Cambiar `MODO` a `actualizar` en el spec y describir los cambios en `CAMBIOS_PENDIENTES`."
>
> Esperar respuesta explícita antes de continuar.

**Si el archivo no existe, o si `MODO = actualizar`:** continuar al Paso 2.

---

## PASO 2 — Ejecutar el SKILL crud-screen

Cargar y seguir el procedimiento completo definido en `.github/skills/crud-screen/SKILL.md`.
El spec file ya fue leído en el Paso 1 — no releerlo, usar los datos extraídos.
