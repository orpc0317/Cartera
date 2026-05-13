---
description: "Cartera — Tokens canónicos de tipo de campo para specs CRUD (prompts/crud-*.md). Manual para el programador que escribe specs + regla de parada para la IA. Cargar siempre al leer, escribir o ejecutar cualquier spec CRUD."
applyTo: "prompts/**"
---

# Cartera — Tokens de Campo para Specs CRUD

Este archivo cumple dos funciones:

1. **Manual para el programador** que escribe un archivo `prompts/crud-*.md`: define qué tokens debes escribir en las columnas `Ver`, `Nuevo`, `Editar` de `TABS_MODAL` y en la columna `render` de `COLUMNAS_TABLA`, y en qué formato exacto.
2. **Ancla de enforcement para la IA** que lee un spec para generar código: lista completa de tokens reconocidos; cualquier token fuera de esta lista → **PARADA OBLIGATORIA**.

---

## ⛔ REGLA DE PARADA — Para la IA

> Al leer cualquier spec (`prompts/crud-*.md`) para generar código, **escanear todas las filas** de `TABS_MODAL` (columnas `Ver`, `Nuevo`, `Editar`) y de `COLUMNAS_TABLA` (columna `render`).
>
> Si encuentras un token que **no aparece en las tablas de este archivo** → **DETENER INMEDIATAMENTE**.  
> No generar ningún archivo. Emitir el siguiente aviso al desarrollador:
>
> ```
> PARADA — Token de campo no reconocido
> Campo:   [nombre del campo]
> Sección: [TABS_MODAL | COLUMNAS_TABLA], columna [Ver | Nuevo | Editar | render]
> Token:   "[valor literal del token encontrado]"
>
> Este token no tiene un blueprint en components.instructions.md.
> Opciones:
>   a) Reemplazar por el token canónico más cercano (ver spec-field-tokens.instructions.md).
>   b) Crear el blueprint §[siguiente §] en components.instructions.md y añadir el token aquí.
> No continuar hasta que el desarrollador elija una opción y actualice el spec.
> ```

Esta regla no tiene excepciones. No "interpretar creativamente" un token desconocido.

---

## 1 · Cómo escribir los tokens en el spec

### Formato canónico

```
Token principal [§X]
Token principal [§X]; modificador1; modificador2
```

- `[§X]` es la referencia directa a la sección del blueprint en `components.instructions.md`. Incluirla siempre en specs nuevos.
- Los modificadores se separan con `;` y van después del token.
- En columnas combinadas (`Nuevo / Editar`), usa el mismo token para ambos modos; si difieren, separa en columnas `Nuevo` y `Editar` individuales.

---

## 2 · Tokens para TABS_MODAL

### 2a — Columna **Ver** (modo vista, solo lectura)

| Token canónico | Blueprint | Cuándo usarlo |
|----------------|-----------|---------------|
| `ViewField` | § N | Campo de solo lectura estándar. **Es el default para modo vista.** Si no se indica nada especial, usar este. |
| `Moneda display [§W]` | § W | Campo de moneda: muestra bandera del país + código ISO. |
| `SelectionButton [§AE]; disabled` | § AE | Botón de selección visual en solo lectura (no interactivo). |
| `Badge activo [§Y]` | § Y | Campo activo/inactivo: badge emerald (activo) o muted (inactivo). |
| `Checkbox [§I]; disabled` | § I | Campo booleano en modo vista: checkbox deshabilitado (no interactivo). Para campos booleanos distintos de `activo`. |
| `—` | — | El campo **no existe** en modo vista (omitir del render). |
| `(spacer)` | — | Celda vacía para completar el grid de columnas. No es un campo. |

> **Regla:** todo campo no listado aquí usa `ViewField`. No inventar tokens de vista adicionales.

---

### 2b — Columnas **Nuevo** y **Editar** (modos de entrada de datos)

| Token canónico | Blueprint | Cuándo usarlo |
|----------------|-----------|---------------|
| `Input [§D]` | § D | Texto libre de una línea. |
| `Input number [§E]` | § E | Número sin unidad de medida. |
| `Input number+sufijo [§AD]` | § AD | Número con unidad de medida como adornment (ej. `m²`, `vara²`, `ft²`). Indicar la fuente de la unidad en la columna **Notas**. |
| `Input fecha [§Z]` | § Z | Fecha (`<input type="date">`). |
| `Textarea [§Z]` | § Z | Texto multilínea. |
| `Select FK [§F]` | § F | Select cuyas opciones provienen de un prop (array con `.codigo` + `.nombre`). Indicar el prop en **Notas**. |
| `Select cat [§G]` | § G | Select con opciones fijas hardcodeadas en código. Listar las opciones en **Notas** o en `REGLAS_ESPECIFICAS`. |
| `Select cod [§H]` | § H | Select donde el código ya es el label visible (no hay `.nombre` distinto). |
| `Select moneda [§W]` | § W | Select de moneda con bandera (usa `CURRENCY_FLAG_MAP`). Options de prop `monedas`. |
| `Select geo [§X]` | § X | `<select>` nativo HTML para país / departamento / municipio con cascade. |
| `CountrySelect [§AA]` | § AA | Componente `CountrySelect` (bandera + nombre, cascade depto → municipio + auto-set moneda). |
| `PhoneField [crud-screens§PhoneField]` | crud-screens.instructions.md | Teléfono: selector de país + número local. Formato E.164. |
| `ClienteCombobox [§AB]` | § AB | Combobox con búsqueda por texto para seleccionar un cliente (Popover). |
| `LogoUpload [§AC]` | § AC | Carga de imagen con validación magic bytes, dimensiones y drag-drop. |
| `SelectionButton [§AE]` | § AE | Botones de selección mutuamente excluyentes (radio group visual, 2 opciones). |
| `Checkbox [§I]` | § I | Checkbox standalone para campo booleano (0/1). |
| `ViewField (readonly)` | § N | Se muestra como ViewField incluso en modo edición: campo que nunca es editable. |
| `—` | — | El campo **no existe** en este modo. |
| `(spacer)` | — | Celda vacía para completar el grid. |

---

### 2c — Modificadores globales

Se concatenan al token con `;`. Pueden combinarse:

| Modificador | Significado |
|-------------|-------------|
| `req` | Campo requerido; validar antes de guardar. |
| `disabled` | Campo renderizado pero siempre deshabilitado. |
| `readonly` | Mostrar como `ViewField` en modo edición (no editable, no `disabled`). |
| `≥0` | Valor numérico debe ser ≥ 0. |
| `>0` | Valor numérico debe ser > 0. |
| `sin-spin` | Ocultar flechas del `<input type="number">`. |
| `max:N` | Longitud máxima del string (N = entero). |
| `req si [condicion]` | Requerido condicionalmente; describir la condición en **Notas** o **Comportamiento**. |
| `disabled si [condicion]` | Deshabilitado condicionalmente; ídem. |

**Ejemplo completo de token con modificadores:**
```
Input number [§E]; req; ≥0; sin-spin
Select moneda [§W]; req; disabled si no hay proyecto
Input [§D]; req; max:10
```

---

## 3 · Tokens para COLUMNAS_TABLA

El token va en la columna **render** de la tabla `COLUMNAS_TABLA`.

| Token canónico | Blueprint | Cuándo usarlo |
|----------------|-----------|---------------|
| `valor directo` | — | Mostrar el valor del campo tal cual (string o número sin formato especial). |
| `fmt(campo)` | — | Número formateado: 2 decimales, locale `es-GT`. |
| `fmt(campo)+sufijo` | § AD | Número formateado + unidad de medida (ej. `fmt(extension) + ' ' + medida`). Indicar la fuente de la unidad en **Notas** de esa fila. |
| `Moneda display [§W]` | § W | Bandera del país + código ISO del campo de moneda (usa `CURRENCY_FLAG_MAP`). |
| `Badge activo [§Y]` | § Y | Badge emerald si `activo=1`, muted si `activo=0`. |
| `nombre FK` | — | Resolver FK numérica a nombre legible desde un prop. Indicar el prop en la columna **Notas** (ej. `nombre de la empresa (prop 'empresas')`). |
| `Flag+nombre` | — | Bandera del país + nombre legible. Ver **Country flag rules** en `ui-conventions.instructions.md`. |
| `Badge custom` | — | Badge con variante o lógica específica. Detallar el render completo (clase, variante, lógica) en `REGLAS_ESPECIFICAS`. |
| `label cat (NOMBRE)` | — | Resolver campo a label de texto desde un array constante. `NOMBRE` = nombre del array (ej. `REGIMENES_ISR`). Importar de `@/lib/constants`. |
| `Sí/No` | — | Campo booleano 1/0 renderizado como texto `"Sí"` / `"No"`. |
| `fecha DD/MM/YYYY` | — | Fecha renderizada con formato `DD/MM/YYYY`. |

---

## 4 · Tokens heredados (specs anteriores al 2025-05)

Los siguientes tokens se usan en specs escritos antes de que existiera este catálogo. La IA **sí los reconoce** y los mapea a su blueprint. Los specs nuevos deben usar el token canónico moderno.

| Token heredado | Mapea a token canónico |
|----------------|------------------------|
| `Input; req` | `Input [§D]; req` |
| `Input number ≥ 0; req; sin-spin: true` | `Input number [§E]; req; ≥0; sin-spin` |
| `Select; req` | Depende del contexto: `Select FK [§F]` / `Select cat [§G]` / `Select cod [§H]` |
| `Select desde prop 'X'; req` | `Select FK [§F]; req` (prop 'X') |
| `Moneda display (bandera + ISO)` | `Moneda display [§W]` |
| `Select moneda con bandera` | `Select moneda [§W]` |
| `CountrySelect` | `CountrySelect [§AA]` |
| `<select> nativo` | `Select geo [§X]` |
| `PhoneField (...)` | `PhoneField [crud-screens§PhoneField]` |
| `Input numeric con sufijo` | `Input number+sufijo [§AD]` |
| `SelectionButton` | `SelectionButton [§AE]` |
| `bandera + ISO (Moneda display rules)` | `Moneda display [§W]` |
| `bandera + ISO del pais (Country flag rules)` | `Flag+nombre` |
| `bandera + nombre del pais (Country flag rules)` | `Flag+nombre` |
| `nombre de la X (del prop 'Y')` | `nombre FK (prop 'Y')` |
| `nombre del X (del prop 'Y')` | `nombre FK (prop 'Y')` |
| `<Badge> emerald si activo=1, muted si activo=0` | `Badge activo [§Y]` |
| `Checkbox 0/1` | `Checkbox [§I]` |
| `Checkbox (disabled)` | `Checkbox [§I]; disabled` |
| `Checkbox; disabled` | `Checkbox [§I]; disabled` |
| `Checkbox` (columna Ver) | `Checkbox [§I]; disabled` si campo no es `activo`; `Badge activo [§Y]` si campo es `activo` |
| `Select` (sin prop indicado) | `Select cat [§G]` si opciones son fijas; `Select FK [§F]` si vienen de BD |
| `Select; coordinadoresFiltrados empresa+proy` | `Select FK [§F]` (prop `coordinadores`) |
| `Select; supervisoresFiltrados empresa+proy` | `Select FK [§F]` (prop `supervisores`) |
| `Select; bancosFiltrados empresa+proy; req` | `Select FK [§F]; req` (prop `bancos`) |
| `Select nullable; filtrado empresa+proyecto` | `Select FK [§F]` |
| `Input; disabled` | `Input [§D]; disabled` |
| `Input number ≥ 0` | `Input number [§E]; ≥0` |
| `Input numeric; req` | `Input number [§E]; req` |
| `Input numeric con sufijo` | `Input number+sufijo [§AD]` |
| `LogoUploadField` | `LogoUpload [§AC]` |
| `<Badge variant="outline"> con RESERVA_ESTADOS` | `Badge custom` |
| `label de 'X' (importar de '@/lib/constants')` | `label cat (X)` |
| `Sí / No (1=Si, 0=No)` | `Sí/No` |
| `fecha formateada (DD/MM/YYYY)` | `fecha DD/MM/YYYY` |
| `codigo de la X (valor directo)` | `valor directo` |

> Si el token heredado no aparece en esta tabla de compatibilidad → aplicar la **REGLA DE PARADA** igual.

---

## 5 · Ejemplo completo correcto

### TABS_MODAL

```markdown
### Tab: General  (icono: MapPin)

**[IDENTIFICACION]**

| Campo    | Label    | Ancho | Ver                             | Nuevo                    | Editar                   | Default (Nuevo)     | Notas |
|----------|----------|-------|---------------------------------|--------------------------|--------------------------|---------------------|-------|
| empresa  | Empresa  | full  | ViewField                       | Select FK [§F]; req      | Select FK [§F]; disabled | primera disponible  | prop `empresas` |
| codigo   | Codigo   | third | ViewField                       | —                        | ViewField (readonly)     | — (auto BD)         | |
| (spacer) |          | third |                                 |                          |                          |                     | |
| (spacer) |          | third |                                 |                          |                          |                     | |

**[GENERAL]**

| Campo   | Label  | Ancho | Ver                   | Nuevo / Editar           | Default (Nuevo) | Notas |
|---------|--------|-------|-----------------------|--------------------------|-----------------|-------|
| nombre  | Nombre | full  | ViewField             | Input [§D]; req          | ''              | |
| moneda  | Moneda | half  | Moneda display [§W]   | Select moneda [§W]; req  | moneda proyecto | prop `monedas` |
| activo  | Activo | half  | Badge activo [§Y]     | Checkbox [§I]            | 1               | |
| modo    | Modo   | half  | SelectionButton [§AE]; disabled | SelectionButton [§AE] | — | mutuamente exclusivo |
```

### COLUMNAS_TABLA

```markdown
| key     | label   | defaultVisible | render                              |
|---------|---------|----------------|-------------------------------------|
| empresa | Empresa | true           | nombre FK (prop `empresas`)         |
| nombre  | Nombre  | true           | valor directo                       |
| moneda  | Moneda  | true           | Moneda display [§W]                 |
| activo  | Activo  | true           | Badge activo [§Y]                   |
| valor   | Valor   | true           | fmt(valor)                          |
| ext     | Ext.    | true           | fmt(campo)+sufijo (medida de fase)  |
```
