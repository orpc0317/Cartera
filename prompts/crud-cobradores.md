# CRUD: Cobradores

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Cobradores                                                   |
| MODULO         | Promesas                                                     |
| TABLA_BD       | `cartera.t_cobrador`                                         |
| RUTA           | `/dashboard/promesas/cobradores`                             |
| PERMISO        | `COB_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota)_  |

> **Nota sobre estos campos:**
> - `PERMISO` y `RUTA`: no estan cubiertos por ningun archivo de instrucciones; siempre declarar.
> - `COLOR_ACENTO`: si se especifica, usarlo tal cual. Si se omite o indica "elegir", leer la tabla **"Accent color per module"** en `.github/instructions/ui-conventions.instructions.md` para ver los colores ya asignados y elegir un tono de Tailwind que no este en uso. Si este modulo esta en la lista utilizar ese color. Al terminar de generar los archivos, agregar la fila del nuevo modulo a esa tabla (validar que no exista ya).
> - `ICONO_LUCIDE`: si se especifica, usarlo tal cual. Si se omite o indica "elegir segun contexto", leer la tabla **"Module icon per screen"** en `.github/instructions/ui-conventions.instructions.md`, elegir el icono Lucide mas representativo que no este ya en uso, verificar que exista en https://lucide.dev/icons/ y agregarlo a la tabla al terminar de generar los archivos. Si este modulo ya existe en la lista utilizar ese icono y no agregarlo a la tabla.

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de Cobradores.
Cada proyecto puede trabajar con varios cobradores, estos seran asociados al momento de registrar pagos.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_cobrador`. Los tipos deben coincidir con la BD.

```
Cobrador {
  cuenta:           varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:          number        -- FK -> cartera.t_empresa.codigo
  proyecto:         number        -- FK -> cartera.t_proyecto.codigo, filtrado por empresa
  codigo:           number        -- parte del PK, gestionado por la base de datos.
  nombre:           string        -- campo obligatorio
  activo:           smallint      -- 1 = activo, 0 = inactivo
  agrego_usuario:   uuid          -- gestionado por sistema
  agrego_fecha:     timestamptz   -- gestionado por sistema
  modifico_usuario: uuid          -- gestionado por sistema
  modifico_fecha:   timestamptz   -- token de concurrencia optimista
}

CobradorForm {              	-- campos editables por el usuario
  empresa:        number	    -- readonly tras creacion (disabled en edit mode)
  proyecto:       number	    -- readonly tras creacion (disabled en edit mode)
  nombre:         string    | not null
  activo:         smallint  | 1 = activo, 0 = inactivo
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

Cascade doble: empresa → proyecto.
- Al cambiar empresa: resetear proyecto al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0.

```

> `getEmpresas` y `getProyectos` aplican `.eq('cuenta', cuenta)` internamente — el campo `cuenta` no aparece en ningún Select ni prop visible.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `nombre`, `activo`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

### Mapeo de permisos a UI

Ver regla general en `crud-screens.instructions.md` → sección **Permission mapping to UI**.

```ts
const permisos = await getPermisosDetalle(PERMISOS.COB_CAT)
// pasar como props: puedeAgregar={permisos.agregar} puedeModificar={permisos.modificar} puedeEliminar={permisos.eliminar}
```

## EXPORTACION

Ver regla general en `data-tables.instructions.md` → sección **CSV Export**.

**Nombre de archivo:** `cobradores-YYYY-MM-DD.csv`

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
`STORAGE_KEY = 'cobradores_cols_v1_${userId}'`

| key            | label           | defaultVisible |
|----------------|-----------------|----------------|
| empresa        | Empresa         | false          |
| proyecto       | Proyecto        | true           |
| nombre         | Nombre          | true           |
| activo         | Activo          | true           |

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
    VIEW MODE:
      - empresa        (full — ViewField; label: "Empresa")
      - proyecto       (full — ViewField; label: "Proyecto")
      - codigo         (full — ViewField; label: "Codigo"; valor: N con font-mono)
    NUEVO / EDIT MODE:
      - empresa        (full — Select; disabled en edit, ver CAMPOS_READONLY_TRAS_CREACION)
      - proyecto       (full — Select; disabled en edit, ver CAMPOS_READONLY_TRAS_CREACION)
      -- codigo no aparece en nuevo ni en edit --
  [SectionDivider "GENERAL"]
    - nombre         (view + edit; full — requerido; label: "Nombre")
    - activo         (view + edit; full — Checkbox 0/1; label: "Activo")

```
> **Nota activo en view mode:** renderizar como `<Checkbox checked={...} disabled />` con label
> a la derecha (no usar la card muted de otros checkboxes en esta pantalla).

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
3. **Validacion de similitud de nombre (frontend):** antes de llamar a `doSave()`, comparar el nombre ingresado
   contra todos los cobradores del mismo `(empresa, proyecto)` usando `jaroWinkler(toDbString(form.nombre), toDbString(x.nombre)) >= 0.85`
   (importar `jaroWinkler, toDbString` de `@/lib/utils`). Si hay coincidencias, mostrar un `AlertDialog` que lista los nombres
   similares y pregunta al usuario si desea continuar. El boton de confirmacion dice `"Si, es diferente — Continuar"`
   y llama a `doSave()`. Al editar, excluir el propio registro del analisis (`x.codigo !== viewTarget.codigo`).
4. Mostrar advertencia si `proyectos.length === 0` y deshabilitar el boton "Nuevo Cobrador".

---

## VALIDACIONES_BACKEND

- Duplicado: `nombre` ya existe en el mismo `(cuenta, empresa, proyecto)` -> `'Ya existe un cobrador con ese nombre en este proyecto.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en `cartera.t_recibo_caja` con el mismo `(cuenta, empresa, proyecto, cobrador)`. Si existen -> `'No se puede eliminar este cobrador porque tiene recibos de caja asociados.'`. La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## UI_ESPECIFICO

- Page header: icono elegido sobre `bg-orange-100`, color icono `text-orange-700`.
- Modal gradient header: `from-orange-50/70 to-transparent`.
- Active row: `bg-orange-50 dark:bg-orange-950/30`.
- Sticky codigo (izquierdo, activo): `border-l-[3px] border-l-orange-600 text-orange-700`.
- Sticky acciones (derecho, activo): `bg-orange-50 dark:bg-orange-950/30`.
- Columna `activo` en tabla: badge `bg-emerald-100 text-emerald-700` para Activo, `bg-muted text-muted-foreground` para Inactivo.

> La estructura de pestanas y secciones del modal esta definida en `TABS_MODAL`.

---

## LOGIC_ESPECIFICO

- Cascade empresa -> proyecto: al cambiar empresa en `f()`, resetear `proyecto` al primer proyecto disponible de esa empresa.
- `openCreate()`: pre-seleccionar primera empresa y primer proyecto de esa empresa (ver patron en `cuentas-cobrar/series-recibos/_client.tsx`).

---

## QUERIES

No requiere RPC ni queries especiales. Lectura directa:

```ts
admin.schema('cartera').from('t_cobrador')
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

1. `src/app/actions/cobradores.ts`
   Funciones: `getCuentaActiva` (privada), `getAuditUser` (privada), `writeAudit` (privada),
   `getCobradores`, `createCobrador`, `updateCobrador`, `deleteCobrador`.

2. `src/app/dashboard/promesas/cobradores/page.tsx`
   Server Component. Usar `Promise.all` con per-call `.catch()` segun patron de `server-actions.instructions.md`.

3. `src/app/dashboard/promesas/cobradores/_client.tsx`
   Client Component completo: tabla con ColumnManager + ColumnFilter + teclado,
   Dialog CRUD (view/create/edit), AlertDialog de eliminacion, AuditLogDialog.

No se requieren archivos adicionales. Este proyecto no usa archivos de hooks separados ni tests.

---

## INSTRUCCION_FINAL

Genera los tres archivos aplicando TODAS las reglas de los archivos de instrucciones listados.
Si existe conflicto entre las reglas generales y las reglas especificas de este prompt, prevalecen las de este prompt.
Tomar como referencia de implementacion el archivo `src/app/dashboard/cuentas-cobrar/series-recibos/_client.tsx`
— es el ejemplo mas completo y actualizado del patron del proyecto.
