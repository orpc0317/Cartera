# CRUD: Bancos

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Bancos                                                |
| MODULO         | Bancos                                               |
| TABLA_BD       | `cartera.t_banco`                                     |
| RUTA           | `/dashboard/bancos/bancos`                   |
| PERMISO        | `BAN_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota)_  |

> **Nota sobre estos campos:**
> - `PERMISO` y `RUTA`: no estan cubiertos por ningun archivo de instrucciones; siempre declarar.
> - `COLOR_ACENTO`: si se especifica, usarlo tal cual. Si se omite o indica "elegir", consultar
>   `ui-conventions.instructions.md` para ver los colores ya asignados por modulo y elegir un tono de Tailwind que no este en uso. 
> Colores ya ocupados al momento de escribir este prompt:
>   emerald (Empresas), sky (Proyectos), violet (Fases), amber (Manzanas), rose  (Lotes), indigo (Clientes), purple (Supervisores), teal (Bancos), cyan (Cuentas Cobrar).
>   Siempre agregar la fila del nuevo modulo en `ui-conventions.instructions.md` al terminar (validar si ya existe).
> - `ICONO_LUCIDE`: si se omite o se indica "elegir segun contexto", la IA selecciona el icono
>   Lucide mas representativo basandose en el nombre y descripcion de la pantalla. Verificar en
>   https://lucide.dev/icons/ que el icono exista antes de aceptar la sugerencia.

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de Bancos.
Cada proyecto puede trabajar con varios bancos.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_banco`. Los tipos deben coincidir con la BD.

```
Banco {
  cuenta:           varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:          number        -- FK -> cartera.t_empresa.codigo
  proyecto:         number        -- FK -> cartera.t_proyecto.codigo, filtrado por empresa
  codigo:           number        -- parte del PK, gestionado por la base de datos.
  nombre:           string        -- campo obligatorio
  agrego_usuario:   uuid          -- gestionado por sistema
  agrego_fecha:     timestamptz   -- gestionado por sistema
  modifico_usuario: uuid          -- gestionado por sistema
  modifico_fecha:   timestamptz   -- token de concurrencia optimista
}

BancoForm {              	-- campos editables por el usuario
  empresa:        number	-- readonly tras creacion (disabled en edit mode)
  proyecto:       number	-- readonly tras creacion (disabled en edit mode)
  nombre:         string | not null
}

```

**LLAVE_PRIMARIA compuesta:** `(cuenta, empresa, proyecto, codigo)`
- `cuenta` es implicito (se obtiene del usuario autenticado, no va en el form)
- Para UPDATE y DELETE identificar por: `empresa + proyecto + codigo`

**CAMPOS_READONLY_TRAS_CREACION:** `empresa`, `proyecto`
Renderizar con `disabled={!!viewTarget}` en modo edicion. No incluir en el payload del UPDATE.

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getEmpresas()       -> prop 'empresas'       -> alimenta el Select de empresa
getProyectos()      -> prop 'proyectos'      -> alimenta el Select de proyecto (filtrado por empresa)
```

Usar el mismo patrón de cascade empresa -> proyecto que tienen otras pantallas del módulo.

> Nota: ambas funciones aplican `.eq('cuenta', cuenta)` internamente. El campo `cuenta` no aparece
> en ningún Select ni prop visible.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `nombre`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

### Mapeo de permisos a UI

| Permiso (`t_menu_usuario`) | Efecto en UI |
|---|---|
| `agregar`    | Muestra/oculta el boton "Nuevo Banco" en la barra de herramientas |
| `modificar`  | Muestra/oculta el boton "Editar" en el footer del modal; cambia el label del menu a "Ver / Editar" vs "Ver" |
| `eliminar`   | Muestra/oculta la opcion "Eliminar" en el dropdown de acciones de cada fila |

Obtener permisos en `page.tsx`:
```ts
const permisos = await getPermisosDetalle(PERMISOS.BAN_CAT)
// pasar como props: puedeAgregar={permisos.agregar} puedeModificar={permisos.modificar} puedeEliminar={permisos.eliminar}

```

## EXPORTACION

Ver regla general en `data-tables.instructions.md` → sección **CSV Export**.

**Nombre de archivo:** `bancos-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `codigo` (label: `"Codigo"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

> La tabla incluye un **selector de columnas** (`ColumnManager`) en la esquina superior derecha
> que permite al usuario mostrar u ocultar columnas y reordenarlas. La preferencia se persiste
> en `localStorage` con `STORAGE_KEY` (clave por usuario). `defaultVisible` define la
> visibilidad inicial la primera vez que el usuario abre la pantalla o al hacer "Restablecer".
>
> Columnas fijas (no entran en el selector):
> - **Sticky izquierdo**: columna identificadora del registro (aqui: `codigo`). Siempre visible.
> - **Sticky derecho**: columna de acciones (menu de 3 puntos). Siempre visible.
>
> Solo las columnas del selector pueden ocultarse.

Sticky izquierdo: `codigo` (label: `"Codigo"`, es el identificador visible del PK).
`STORAGE_KEY = 'bancos_cols_v1_${userId}'`

| key            | label           | defaultVisible |
|----------------|-----------------|----------------|
| empresa        | Empresa         | false          |
| proyecto       | Proyecto        | true           |
| nombre         | Nombre          | true           |

---

## TABS_MODAL

> La primera pestana es siempre **General** y es obligatoria. Agregar pestanas adicionales
> solo si la pantalla lo requiere. Cada pestana contiene secciones; cada seccion se renderiza
> con `SectionDivider` y lista los campos en el orden en que deben aparecer.
> En view mode y edit mode se aplica el mismo mapa de secciones (los campos cambian de
> `<ViewField>` a `<Input>`/`<Select>`/`<Checkbox>` segun el modo).

```
Pestana: General  (icono: MapPin)
  [SectionDivider "IDENTIFICACION"]
    - empresa        (view + edit; full — disabled en edit si CAMPO_READONLY_TRAS_CREACION)
    - proyecto       (view + edit; full — disabled en edit si CAMPO_READONLY_TRAS_CREACION)
    - codigo          (view only; full)
  [SectionDivider "GENERAL"]
    - nombre         (view + edit; full; requerido)

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

1. `codigo` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `nombre` dentro del mismo `(cuenta, empresa, proyecto)`. Validar en backend antes del INSERT
   con `.eq('cuenta', cuenta).eq('empresa', ...).eq('proyecto', ...).eq('nombre', ...)`.
3. Mostrar advertencia si `proyectos.length === 0` y deshabilitar el boton "Nuevo Banco".

---

## VALIDACIONES_BACKEND

- Duplicado: `nombre` ya existe en el mismo `(cuenta, empresa, proyecto)` -> `'Ya existe un banco con ese nombre en este proyecto.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en `cartera.t_cuenta_bancaria` con el mismo `(cuenta, empresa, proyecto, banco)`. Si existen -> `'No se puede eliminar este banco porque tiene cuentas bancarias asociadas.'`. La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en `cartera.t_recibo_caja` con el mismo `(cuenta, empresa, proyecto, banco)`. Si existen -> `'No se puede eliminar este banco porque tiene recibos de caja asociados.'`. La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## UI_ESPECIFICO

- Page header: icono elegido sobre `bg-{acento}-100`, color icono `text-{acento}-700`.
- Modal gradient header: `from-{acento}-50/70 to-transparent`.
- Active row: `bg-{acento}-50 dark:bg-{acento}-950/30`.
- Sticky codigo (izquierdo, activo): `border-l-[3px] border-l-{acento}-600 text-{acento}-700`.
- Sticky acciones (derecho, activo): `bg-{acento}-50 dark:bg-{acento}-950/30`.

> La estructura de pestanas y secciones del modal esta definida en `TABS_MODAL`.

---

## LOGIC_ESPECIFICO

- Cascade empresa -> proyecto: al cambiar empresa en `f()`, resetear `proyecto` al primer proyecto disponible de esa empresa.
- `openCreate()`: pre-seleccionar primera empresa y primer proyecto de esa empresa (ver patron en `cuentas-cobrar/series-recibos/_client.tsx`).

---

## QUERIES

No requiere RPC ni queries especiales. Lectura directa:

```ts
admin.schema('cartera').from('t_banco')
  .select('*').eq('cuenta', cuenta)
  .order('nombre')
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

1. `src/app/actions/bancos.ts`
   Funciones: `getCuentaActiva` (privada), `getAuditUser` (privada), `writeAudit` (privada),
   `getBanco`, `createBanco`, `updateBanco`, `deleteBanco`.

2. `src/app/dashboard/bancos/bancos/page.tsx`
   Server Component. Usar `Promise.all` con per-call `.catch()` segun patron de `server-actions.instructions.md`.

3. `src/app/dashboard/bancos/bancos/_client.tsx`
   Client Component completo: tabla con ColumnManager + ColumnFilter + teclado,
   Dialog CRUD (view/create/edit), AlertDialog de eliminacion, AuditLogDialog.

No se requieren archivos adicionales. Este proyecto no usa archivos de hooks separados ni tests.

---

## INSTRUCCION_FINAL

Genera los tres archivos aplicando TODAS las reglas de los archivos de instrucciones listados.
Si existe conflicto entre las reglas generales y las reglas especificas de este prompt, prevalecen las de este prompt.
Tomar como referencia de implementacion el archivo `src/app/dashboard/cuentas-cobrar/series-recibos/_client.tsx`
— es el ejemplo mas completo y actualizado del patron del proyecto.
