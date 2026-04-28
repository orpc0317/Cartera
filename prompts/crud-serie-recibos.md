# CRUD: Serie Recibos

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Serie Recibos                                                |
| MODULO         | Cuentas Cobrar                                               |
| TABLA_BD       | `cartera.t_serie_recibo`                                     |
| RUTA           | `/dashboard/cuentas-cobrar/series-recibos`                   |
| PERMISO        | `SER_REC` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota)_  |

> **Nota sobre estos campos:**
> - `PERMISO` y `RUTA`: no estan cubiertos por ningun archivo de instrucciones; siempre declarar.
> - `COLOR_ACENTO`: si se especifica, usarlo tal cual. Si se omite o indica "elegir", consultar
>   `ui-conventions.instructions.md` para ver los colores ya asignados por modulo y elegir un tono de Tailwind que no este en uso. 
> Colores ya ocupados al momento de escribir este prompt:
>   emerald (Empresas), sky (Proyectos), violet (Fases), amber (Manzanas), rose  (Lotes), indigo (Clientes), purple (Supervisores), teal (Bancos), cyan (Cuentas Cobrar).
>   Siempre agregar la fila del nuevo modulo en `ui-conventions.instructions.md` al terminar.
> - `ICONO_LUCIDE`: si se omite o se indica "elegir segun contexto", la IA selecciona el icono
>   Lucide mas representativo basandose en el nombre y descripcion de la pantalla. Verificar en
>   https://lucide.dev/icons/ que el icono exista antes de aceptar la sugerencia.

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de Series de Recibos.
Cada proyecto puede tener varias series; una de ellas es la predeterminada.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_serie_recibo`. Los tipos deben coincidir con la BD.

```
SerieRecibo {
  cuenta:           varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:          number        -- FK -> cartera.t_empresa.codigo
  proyecto:         number        -- FK -> cartera.t_proyecto.codigo, filtrado por empresa
  serie:            varchar       -- parte del PK, readonly tras creacion
  serie_factura:    varchar|null  -- opcional FK -> cartera.t_serie_factura.serie, filtrado por proyecto
  dias_fecha:       smallint      -- default 0
  correlativo:      smallint      -- default 0
  formato:          smallint      -- default 0
  predeterminado:   smallint      -- 0/1
  recibo_automatico: smallint     -- 0/1
  activo:           smallint      -- 0/1
  agrego_usuario:   uuid          -- gestionado por sistema
  agrego_fecha:     timestamptz   -- gestionado por sistema
  modifico_usuario: uuid          -- gestionado por sistema
  modifico_fecha:   timestamptz   -- token de concurrencia optimista
}

SerieReciboForm {              	-- campos editables por el usuario
  empresa:        number	-- readonly tras creacion (disabled en edit mode)
  proyecto:       number	-- readonly tras creacion (disabled en edit mode)
  serie:          string       	-- readonly tras creacion (disabled en edit mode)
  serie_factura:  string | null -- null = sin serie de factura
  dias_fecha:     number
  correlativo:    number
  formato:        number
  predeterminado: number
  recibo_automatico: number
  activo:         number
}
```

**LLAVE_PRIMARIA compuesta:** `(cuenta, empresa, proyecto, serie)`
- `cuenta` es implicito (se obtiene del usuario autenticado, no va en el form)
- Para UPDATE y DELETE identificar por: `empresa + proyecto + serie`

**CAMPOS_READONLY_TRAS_CREACION:** `empresa`, `proyecto`, `serie`
Renderizar con `disabled={!!viewTarget}` en modo edicion. No incluir en el payload del UPDATE.

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getEmpresas()       -> prop 'empresas'       -> alimenta el Select de empresa
getProyectos()      -> prop 'proyectos'      -> alimenta el Select de proyecto (filtrado por empresa)
getSeriesFactura()  -> prop 'seriesFactura'  -> alimenta el Select de serie_factura (filtrado por proyecto)
```

Usar el mismo patron de cascade empresa -> proyecto que tienen Bancos y Cuentas Bancarias.

`getSeriesFactura()` debe leer toda la tabla `cartera.t_serie_factura` filtrando por `cuenta`
(obtenida con `getCuentaActiva()`, igual que todas las demas funciones del proyecto — `cuenta` nunca
se expone en UI ni se pasa como prop). El filtrado por `proyecto` se hace en cliente.
Columnas minimas: `empresa`, `proyecto`, `serie`.

> Nota general: las tres funciones FK (`getEmpresas`, `getProyectos`, `getSeriesFactura`) aplican
> `.eq('cuenta', cuenta)` internamente. El campo `cuenta` no aparece en ningun Select ni prop visible.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `serie_factura`, `dias_fecha`, `correlativo`, `formato`, `predeterminado`, `recibo_automatico`, `activo`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

### Mapeo de permisos a UI

| Permiso (`t_menu_usuario`) | Efecto en UI |
|---|---|
| `agregar`    | Muestra/oculta el boton "Nueva Serie" en la barra de herramientas |
| `modificar`  | Muestra/oculta el boton "Editar" en el footer del modal; cambia el label del menu a "Ver / Editar" vs "Ver" |
| `eliminar`   | Muestra/oculta la opcion "Eliminar" en el dropdown de acciones de cada fila |

Obtener permisos en `page.tsx`:
```ts
const permisos = await getPermisosDetalle(PERMISOS.SER_REC)
// pasar como props: puedeAgregar={permisos.agregar} puedeModificar={permisos.modificar} puedeEliminar={permisos.eliminar}
```

---

## EXPORTACION

Ver regla general en `data-tables.instructions.md` → sección **CSV Export**.

**Nombre de archivo:** `series-recibos-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `serie` (label: `"Serie"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

> La tabla incluye un **selector de columnas** (`ColumnManager`) en la esquina superior derecha
> que permite al usuario mostrar u ocultar columnas y reordenarlas. La preferencia se persiste
> en `localStorage` con `STORAGE_KEY` (clave por usuario). `defaultVisible` define la
> visibilidad inicial la primera vez que el usuario abre la pantalla o al hacer "Restablecer".
>
> Columnas fijas (no entran en el selector):
> - **Sticky izquierdo**: columna identificadora del registro (aqui: `serie`). Siempre visible.
> - **Sticky derecho**: columna de acciones (menu de 3 puntos). Siempre visible.
>
> Solo las columnas del selector pueden ocultarse.

Sticky izquierdo: `serie` (label: `"Serie"`, es el identificador visible del PK).
`STORAGE_KEY = 'series_recibos_cols_v2_${userId}'`

| key            | label           | defaultVisible |
|----------------|-----------------|----------------|
| empresa        | Empresa         | false          |
| proyecto       | Proyecto        | true           |
| recibo_automatico | Recibo Auto  | true           |
| correlativo    | Correlativo     | false          |
| predeterminado | Predeterminado  | true           |
| formato        | Formato         | true           |
| serie_factura  | Serie Factura   | true           |
| dias_fecha     | Dias Fecha      | false          |
| activo         | Activo          | true           |

---

## TABS_MODAL

> La primera pestana es siempre **General** y es obligatoria. Agregar pestanas adicionales
> solo si la pantalla lo requiere. Cada pestana contiene secciones; cada seccion se renderiza
> con `SectionDivider` y lista los campos en el orden en que deben aparecer.
> En view mode y edit mode se aplica el mismo mapa de secciones (los campos cambian de
> `<ViewField>` a `<Input>`/`<Select>`/`<Checkbox>` segun el modo).

```
Pestana: General  (icono: ICONO_LUCIDE de la pantalla)
  [SectionDivider "IDENTIFICACION"]
    - empresa        (view + edit; full — disabled en edit si CAMPO_READONLY_TRAS_CREACION)
    - proyecto       (view + edit; full — disabled en edit si CAMPO_READONLY_TRAS_CREACION)
    - serie          (view + edit; full — disabled en edit — es parte del PK)
  [SectionDivider "CONFIGURACION"]
    - recibo_automatico (view + edit; third — Checkbox 0/1)
    - correlativo    (view + edit; third)
    - formato        (view + edit; third — input numerico, minimo 0)
    - dias_fecha     (view + edit; half)
    - serie_factura  (view + edit; half)
    - predeterminado    (view + edit; half — Checkbox 0/1)
    - activo            (view + edit; half — Checkbox 0/1)
```

> Si se necesitan mas pestanas, agregar bloques con el mismo formato:
> ```
> Pestana: <Nombre>  (icono: <NombreIconoLucide>)
>   [SectionDivider "<TITULO SECCION>"]
>     - campo1
>     - campo2
> ```

---

## REGLAS_ESPECIFICAS

1. `serie` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `serie` dentro del mismo `(cuenta, empresa, proyecto)`. Validar en backend antes del INSERT
   con `.eq('cuenta', cuenta).eq('empresa', ...).eq('proyecto', ...).eq('serie', ...)`.
3. `serie_factura` es un `<Select>` (FK de `t_serie_factura`), **no** un input de texto libre.
   - El primer elemento del Select debe ser `value="" / label " "` (espacio en blanco), que representa `null` en BD. No mostrar texto como "(Ninguna)".
   - Filtrar en cliente: `seriesFactura.filter(s => s.empresa === f.empresa && s.proyecto === f.proyecto)`.
     (El codigo de proyecto puede repetirse entre empresas distintas; ambos filtros son necesarios.)
   - Al guardar: convertir `""` a `null` antes de enviar al server action.
   - No aplica normalización `f()` ni `toUpperCase()` para este campo; agregarlo a `SKIP_KEYS` para que `f()` no lo toque.
4. `formato` es un campo numerico libre (input tipo number, minimo 0). Identifica la plantilla de
   impresion del recibo de caja: el valor `n` corresponde al template `ReciboCajaN` (ej: `2` -> `ReciboCaja2`).
   - Valor `0` significa que la serie no tiene formato de impresion definido; mostrar como `0` en tabla y
     en view mode (no como texto especial).
   - No es un Select ni tiene opciones fijas — el usuario escribe el numero directamente.
   - **No se permiten valores negativos.** Clampar en `onChange`: `Math.max(0, Number(e.target.value) || 0)`.
5. `predeterminado`, `recibo_automatico` y `activo` son checkboxes (smallint 0/1), no Selects.
6. Valores por defecto al crear: `activo = 1`, todos los demas numericos en `0`.
7. Mostrar advertencia si `proyectos.length === 0` y deshabilitar el boton "Nueva Serie".
8. **Unicidad de `predeterminado`:** dentro de un mismo `(cuenta, empresa, proyecto)` solo puede
   haber una serie con `predeterminado = 1`. En el backend, **antes** del INSERT/UPDATE principal,
   si `form.predeterminado === 1` ejecutar:
   ```ts
   await admin.schema('cartera').from('t_serie_recibo')
     .update({ predeterminado: 0 })
     .eq('cuenta', cuenta).eq('empresa', empresa).eq('proyecto', proyecto)
     .neq('serie', serie)   // excluir el propio registro en UPDATE; en INSERT excluir por serie nueva
   ```
   Esto garantiza que al activar una serie como predeterminada, todas las demas del mismo proyecto
   queden en `0`, independientemente de quien haya hecho el cambio previo.
9. **Correlativo bloqueado por Recibo Automatico:** si `recibo_automatico === 1`, el campo `correlativo`
   debe mostrarse **en blanco e ineditable** (Input deshabilitado, value vacio) tanto en creacion como en
   edicion. Al guardar, enviar `correlativo: 0`. Si `recibo_automatico === 0`, el campo esta habilitado
   para entrada manual. En view mode y en la tabla, mostrar `correlativo` en blanco cuando su valor es `0`.
   - **No se permiten valores negativos.** Clampar en `onChange`: `Math.max(0, Number(e.target.value) || 0)`.
   - **sin-spin: true** — los correlativos pueden ser numeros muy grandes; los spin buttons son inutiles. Aplicar clase `[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`.

---

## VALIDACIONES_BACKEND

- Duplicado: `serie` ya existe en el mismo `(cuenta, empresa, proyecto)` -> `'Ya existe una serie con ese codigo en este proyecto.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en `cartera.t_recibo_caja` con el mismo `(cuenta, empresa, proyecto, serie)`. Si existen -> `'No se puede eliminar esta serie porque tiene recibos de caja asociados.'`. La verificacion usa `.select('cuenta', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## UI_ESPECIFICO

- Page header: icono elegido sobre `bg-{acento}-100`, color icono `text-{acento}-700`.
- Modal gradient header: `from-{acento}-50/70 to-transparent`.
- Active row: `bg-{acento}-50 dark:bg-{acento}-950/30`.
- Sticky codigo (izquierdo, activo): `border-l-[3px] border-l-{acento}-600 text-{acento}-700`.
- Sticky acciones (derecho, activo): `bg-{acento}-50 dark:bg-{acento}-950/30`.
- `predeterminado` y `activo` en view mode: `<Checkbox checked={...} disabled />` dentro de card muted.

> La estructura de pestanas y secciones del modal esta definida en `TABS_MODAL`.

---

## LOGIC_ESPECIFICO

- Cascade empresa -> proyecto: al cambiar empresa en `f()`, resetear `proyecto` al primer proyecto disponible de esa empresa; resetear tambien `serie_factura` a `null`.
- Cascade proyecto -> serie_factura: al cambiar `proyecto` en `f()`, resetear `serie_factura` a `null` (el Select mostrara las series filtradas por el nuevo proyecto).
- `openCreate()`: pre-seleccionar primera empresa y primer proyecto de esa empresa (ver patron en `bancos/_client.tsx`); `serie_factura` inicia en `null`.

---

## QUERIES

No requiere RPC ni queries especiales. Lectura directa:

```ts
admin.schema('cartera').from('t_serie_recibo')
  .select('*').eq('cuenta', cuenta)
  .order('empresa').order('proyecto').order('serie')
```

---

## USA_ESTRICTAMENTE

- `.github/instructions/crud-screens.instructions.md`
- `.github/instructions/data-tables.instructions.md`
- `.github/instructions/server-actions.instructions.md`
- `.github/instructions/ui-conventions.instructions.md`

---

## ARCHIVOS_SALIDA

Exactamente tres archivos, en este orden:

1. `src/app/actions/series-recibos.ts`
   Funciones: `getCuentaActiva` (privada), `getAuditUser` (privada), `writeAudit` (privada),
   `getSeriesRecibos`, `createSerieRecibo`, `updateSerieRecibo`, `deleteSerieRecibo`.

2. `src/app/dashboard/cuentas-cobrar/series-recibos/page.tsx`
   Server Component. Usar `Promise.all` con per-call `.catch()` segun patron de `server-actions.instructions.md`.

3. `src/app/dashboard/cuentas-cobrar/series-recibos/_client.tsx`
   Client Component completo: tabla con ColumnManager + ColumnFilter + teclado,
   Dialog CRUD (view/create/edit), AlertDialog de eliminacion, AuditLogDialog.

No se requieren archivos adicionales. Este proyecto no usa archivos de hooks separados ni tests.

---

## INSTRUCCION_FINAL

Genera los tres archivos aplicando TODAS las reglas de los archivos de instrucciones listados.
Si existe conflicto entre las reglas generales y las reglas especificas de este prompt,
prevalecen las de este prompt.
Tomar como referencia de implementacion el archivo `src/app/dashboard/bancos/bancos/_client.tsx`
— es el ejemplo mas completo y actualizado del patron del proyecto.
