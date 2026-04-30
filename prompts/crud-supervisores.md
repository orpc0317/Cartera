# CRUD: Supervisores

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Supervisores                                                 |
| MODULO         | Promesas                                                     |
| TABLA_BD       | `cartera.t_supervisor`                                       |
| RUTA           | `/dashboard/promesas/supervisores`                           |
| PERMISO        | `SUP_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota)_  |
| MODO           | nuevo                                                        |

> **Nota sobre estos campos:**
> - `PERMISO` y `RUTA`: no estan cubiertos por ningun archivo de instrucciones; siempre declarar.
> - `COLOR_ACENTO`: si se especifica, usarlo tal cual. Si se omite o indica "elegir", leer la tabla **"Accent color per module"** en `.github/instructions/ui-conventions.instructions.md` para ver los colores ya asignados y elegir un tono de Tailwind que no este en uso. Si este modulo esta en la lista utilizar ese color. Al terminar de generar los archivos, agregar la fila del nuevo modulo a esa tabla (validar que no exista ya).
> - `ICONO_LUCIDE`: si se especifica, usarlo tal cual. Si se omite o indica "elegir segun contexto", leer la tabla **"Module icon per screen"** en `.github/instructions/ui-conventions.instructions.md`, elegir el icono Lucide mas representativo que no este ya en uso, verificar que exista en https://lucide.dev/icons/ y agregarlo a la tabla al terminar de generar los archivos. Si este modulo ya existe en la lista utilizar ese icono y no agregarlo a la tabla.

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de Supervisores.
Cada proyecto puede trabajar con varios supervisores.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_supervisor`. Los tipos deben coincidir con la BD.

```
Supervisor {
  cuenta:           varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:          number        -- FK -> cartera.t_empresa.codigo
  proyecto:         number        -- FK -> cartera.t_proyecto.codigo, filtrado por empresa
  codigo:           number        -- parte del PK, gestionado por la base de datos.
  nombre:           string
  activo:           smallint      -- 1 = activo, 0 = inactivo
  agrego_usuario:   uuid          -- gestionado por sistema
  agrego_fecha:     timestamptz   -- gestionado por sistema
  modifico_usuario: uuid          -- gestionado por sistema
  modifico_fecha:   timestamptz   -- token de concurrencia optimista
}

SupervisorForm {              	-- campos editables por el usuario
  empresa:        number
  proyecto:       number
  nombre:         string
  activo:         smallint
}

```

**LLAVE_PRIMARIA compuesta:** `(cuenta, empresa, proyecto, codigo)`
- `cuenta` es implicito (se obtiene del usuario autenticado, no va en el form)
- Para UPDATE y DELETE identificar por: `empresa + proyecto + codigo`
- `empresa` y `proyecto` son readonly tras creacion: no incluir en el payload del UPDATE.

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getEmpresas()       -> prop 'empresas'       -> alimenta el Select de empresa
getProyectos()      -> prop 'proyectos'      -> alimenta el Select de proyecto (filtrado por empresa)
```

Cascade doble: empresa → proyecto.
- Al cambiar empresa: resetear proyecto al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0.

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
const permisos = await getPermisosDetalle(PERMISOS.SUP_CAT)
// pasar como props: puedeAgregar={permisos.agregar} puedeModificar={permisos.modificar} puedeEliminar={permisos.eliminar}

```

## EXPORTACION

Ver regla general en `data-tables.instructions.md` → sección **CSV Export**.

**Nombre de archivo:** `supervisores-YYYY-MM-DD.csv`

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
`STORAGE_KEY = 'supervisores_cols_v1_${userId}'`

> **Regla para FKs en la tabla:** nunca mostrar el ID numerico. Resolver al nombre legible:
> `empresa` → nombre de la empresa (prop `empresas`); `proyecto` → nombre del proyecto (prop `proyectos`).

| key            | label           | defaultVisible | render                                                |
|----------------|-----------------|----------------|-------------------------------------------------------|
| empresa        | Empresa         | false          | nombre de la empresa (del prop `empresas`)            |
| proyecto       | Proyecto        | true           | nombre del proyecto (del prop `proyectos`)            |
| nombre         | Nombre          | true           | valor directo                                         |
| activo         | Activo          | true           | `<Badge>` emerald si activo=1, muted si activo=0      |

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

| Campo  | Label  | Ancho | View          | Nuevo / Edit | Notas |
|--------|--------|-------|---------------|--------------|-------|
| nombre | Nombre | full  | ViewField     | Input; req   |       |
| activo | Activo | full  | Checkbox card | Checkbox 0/1 |       |

---

## REGLAS_ESPECIFICAS

1. `codigo` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `nombre` dentro del mismo `(cuenta, empresa, proyecto)`. Validar en backend antes del INSERT con `.eq('cuenta', cuenta).eq('empresa', ...).eq('proyecto', ...).eq('nombre', ...)`.
3. **Validacion de similitud de nombre (frontend):** antes de llamar a `doSave()`, comparar el nombre ingresado
   contra todos los supervisores del mismo `(empresa, proyecto)` usando `jaroWinkler(toDbString(form.nombre), toDbString(x.nombre)) >= 0.85` (importar `jaroWinkler, toDbString` de `@/lib/utils`). Si hay coincidencias, mostrar un `AlertDialog` que lista los nombres similares y pregunta al usuario si desea continuar. El boton de confirmacion dice `"Si, es diferente — Continuar"` y llama a `doSave()`. Al editar, excluir el propio registro del analisis (`x.codigo !== viewTarget.codigo`).
4. Mostrar advertencia si `proyectos.length === 0` y deshabilitar el boton "Nuevo Supervisor".

---

## VALIDACIONES_BACKEND

- Duplicado: `nombre` ya existe en el mismo `(cuenta, empresa, proyecto)` -> `'Ya existe un supervisor con ese nombre en este proyecto.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en `cartera.t_coordinador` con el mismo `(cuenta, empresa, proyecto, supervisor)`. Si existen -> `'No se puede eliminar este supervisor porque tiene coordinadores asociados.'`. La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## UI_ESPECIFICO

> Aplicar **Accent patterns** de `ui-conventions.instructions.md` usando el color de acento del modulo.

> La estructura de pestanas y secciones del modal esta definida en `TABS_MODAL`.

---

## LOGIC_ESPECIFICO

- Cascadas en `f()`: ver seccion **RELACIONES** para el detalle completo de cada cascada.
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

1. `src/app/actions/supervisores.ts`
   Funciones: `getCuentaActiva` (privada), `getAuditUser` (privada), `writeAudit` (privada),
   `getSupervisores`, `createSupervisor`, `updateSupervisor`, `deleteSupervisor`.

2. `src/app/dashboard/promesas/supervisores/page.tsx`
   Server Component. Usar `Promise.all` con per-call `.catch()` segun patron de `server-actions.instructions.md`.

3. `src/app/dashboard/promesas/supervisores/_client.tsx`
   Client Component completo: tabla con ColumnManager + ColumnFilter + teclado,
   Dialog CRUD (view/create/edit), AlertDialog de eliminacion, AuditLogDialog.

No se requieren archivos adicionales. Este proyecto no usa archivos de hooks separados ni tests.

---

## CAMBIOS_PENDIENTES

> Solo se aplica cuando `MODO = actualizar`. Describe el delta exacto a aplicar sobre los archivos ya existentes.
> Vaciar esta sección (dejar solo esta instrucción) después de aplicar los cambios y devolver `MODO` a `nuevo`.
> Ejemplo de como se deberia especificar puntualmente los cambios realizados:
> [ENTIDAD] Agregar campo `campoXX` (string) a `EstructuraForm`
> [TABS_MODAL / General / GENERAL] Agregar fila: campoXX | Lable | half | ViewField | Input |
> [COLUMNAS_TABLA] Agregar columna `campoXX`, defaultVisible=false

_(sin cambios pendientes)_

---

## INSTRUCCION_FINAL

- Si `MODO = nuevo`: genera los tres archivos completos aplicando TODAS las reglas de los archivos de instrucciones listados.
- Si `MODO = actualizar`: lee los archivos existentes y aplica **únicamente** los cambios listados en `CAMBIOS_PENDIENTES`, sin regenerar ni tocar nada que no esté en esa lista.

En ambos modos: si existe conflicto entre las reglas generales y las reglas específicas de este prompt, prevalecen las de este prompt.
