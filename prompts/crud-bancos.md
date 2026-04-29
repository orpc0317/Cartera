# CRUD: Bancos

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Bancos                                                       |
| MODULO         | Bancos                                                       |
| TABLA_BD       | `cartera.t_banco`                                            |
| RUTA           | `/dashboard/bancos/bancos`                                   |
| PERMISO        | `BAN_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota)_  |

> **Nota sobre estos campos:**
> - `PERMISO` y `RUTA`: no estan cubiertos por ningun archivo de instrucciones; siempre declarar.
> - `COLOR_ACENTO`: si se especifica, usarlo tal cual. Si se omite o indica "elegir", leer la tabla **"Accent color per module"** en `.github/instructions/ui-conventions.instructions.md` para ver los colores ya asignados y elegir un tono de Tailwind que no este en uso. Si este modulo esta en la lista utilizar ese color. Al terminar de generar los archivos, agregar la fila del nuevo modulo a esa tabla (validar que no exista ya).
> - `ICONO_LUCIDE`: si se especifica, usarlo tal cual. Si se omite o indica "elegir segun contexto", leer la tabla **"Module icon per screen"** en `.github/instructions/ui-conventions.instructions.md`, elegir el icono Lucide mas representativo que no este ya en uso, verificar que exista en https://lucide.dev/icons/ y agregarlo a la tabla al terminar de generar los archivos. Si este modulo ya existe en la lista utilizar ese icono y no agregarlo a la tabla.

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

Cascade doble: empresa → proyecto.
- Al cambiar empresa: resetear proyecto al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0.

```

> `getEmpresas` y `getProyectos` aplican `.eq('cuenta', cuenta)` internamente — el campo `cuenta` no aparece en ningún Select ni prop visible.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `nombre`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

### Mapeo de permisos a UI

Ver regla general en `crud-screens.instructions.md` → sección **Permission mapping to UI**.

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

### Tab: General  (icono: MapPin)

**[IDENTIFICACION]**

| Campo    | Label    | Ancho | View      | Nuevo       | Edit             | Notas |
|----------|----------|-------|-----------|-------------|------------------|-------|
| empresa  | Empresa  | full  | ViewField | Select; req | Select; disabled |       |
| proyecto | Proyecto | full  | ViewField | Select; req | Select; disabled |       |
| codigo   | Codigo   | full  | ViewField | —           | —                |       |

**[GENERAL]**

| Campo  | Label  | Ancho | View      | Nuevo / Edit | Notas |
|--------|--------|-------|-----------|--------------|-------|
| nombre | Nombre | full  | ViewField | Input; req   |       |

---

## REGLAS_ESPECIFICAS

1. `codigo` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `nombre` dentro del mismo `(cuenta, empresa, proyecto)`. Validar en backend antes del INSERT con `.eq('cuenta', cuenta).eq('empresa', ...).eq('proyecto', ...).eq('nombre', ...)`.
3. **Validacion de similitud de nombre (frontend):** antes de llamar a `doSave()`, comparar el nombre ingresado
   contra todos los bancos del mismo `(empresa, proyecto)` usando `jaroWinkler(toDbString(form.nombre), toDbString(x.nombre)) >= 0.85` (importar `jaroWinkler, toDbString` de `@/lib/utils`). Si hay coincidencias, mostrar un `AlertDialog` que lista los nombres similares y pregunta al usuario si desea continuar. El boton de confirmacion dice `"Si, es diferente — Continuar"` y llama a `doSave()`. Al editar, excluir el propio registro del analisis (`x.codigo !== viewTarget.codigo`).
4. Mostrar advertencia si `proyectos.length === 0` y deshabilitar el boton "Nuevo Banco".

---

## VALIDACIONES_BACKEND

- Duplicado: `nombre` ya existe en el mismo `(cuenta, empresa, proyecto)` -> `'Ya existe un banco con ese nombre en este proyecto.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en `cartera.t_cuenta_bancaria` con el mismo `(cuenta, empresa, proyecto, banco)`. Si existen -> `'No se puede eliminar este banco porque tiene cuentas bancarias asociadas.'`. La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en `cartera.t_recibo_caja` con el mismo `(cuenta, empresa, proyecto, banco)`. Si existen -> `'No se puede eliminar este banco porque tiene recibos de caja asociados.'`. La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## UI_ESPECIFICO

> Aplicar **Accent patterns** de `ui-conventions.instructions.md` usando el color de acento del modulo.

> La estructura de pestanas y secciones del modal esta definida en `TABS_MODAL`.

---

## LOGIC_ESPECIFICO

- Cascade empresa -> proyecto: al cambiar empresa en `f()`, resetear `proyecto` al primer proyecto disponible de esa empresa (0 si no hay ninguno).
- `openCreate()`: pre-seleccionar primera empresa y primer proyecto de esa empresa.

---

## QUERIES_TABLA

No requiere RPC ni queries especiales. Orden: `.order('empresa').order('proyecto').order('nombre')`.

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
