# CRUD: Coordinadores

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Coordinadores                                                |
| MODULO         | Promesas                                                     |
| TABLA_BD       | `cartera.t_coordinador`                                      |
| RUTA           | `/dashboard/promesas/coordinadores`                          |
| PERMISO        | `COO_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | `blue-100 / blue-600`                                        |
| ICONO_LUCIDE   | `Network`                                                    |
| MODO           | nuevo                                                        |

> **Nota sobre estos campos:**
> - `PERMISO` y `RUTA`: no estan cubiertos por ningun archivo de instrucciones; siempre declarar.
> - `COLOR_ACENTO`: si se especifica, usarlo tal cual. Si se omite o indica "elegir", leer la tabla **"Accent color per module"** en `.github/instructions/ui-conventions.instructions.md` para ver los colores ya asignados y elegir un tono de Tailwind que no este en uso. Si este modulo esta en la lista utilizar ese color. Al terminar de generar los archivos, agregar la fila del nuevo modulo a esa tabla (validar que no exista ya).
> - `ICONO_LUCIDE`: si se especifica, usarlo tal cual. Si se omite o indica "elegir segun contexto", leer la tabla **"Module icon per screen"** en `.github/instructions/ui-conventions.instructions.md`, elegir el icono Lucide mas representativo que no este ya en uso, verificar que exista en https://lucide.dev/icons/ y agregarlo a la tabla al terminar de generar los archivos. Si este modulo ya existe en la lista utilizar ese icono y no agregarlo a la tabla.
> - `MODO`: "nuevo" para que este prompt se utilice para desarrollar la pantalla desde cero. En modo "nuevo", si ya existiera una pantalla desarrollada para este prompt, antes de iniciar el desarrollos desce 0, se debe consultar e indicar al programador que ya hay una pantalla relacionada y que la IA la va a volver a desarrollar desde 0. Si el programador dice que SI, se procede, si dice que NO no se hace nada; "actualizar" para que este prompt se utilice estrictamente para hacer cambios a esta pantalla. Los camibos se deben detallar muy detenidamente en [CAMBIOS_PENDIENTES] y una vez realizados los cambios hay que regresar el `MODO`a "nuevo", que es el estado natural de este prompt. Y tambien hay que dejar nuevamente [CAMBIOS_PENDIENTES] en _(sin cambios pendientes)_

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de Coordinadores.
Cada proyecto puede trabajar con varios coordinadores.
Los coordinadores agrupan vendedores.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_coordinador`. Los tipos deben coincidir con la BD.

```
Coordinador {
  cuenta:           varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:          number        -- FK -> cartera.t_empresa.codigo
  proyecto:         number        -- FK -> cartera.t_proyecto.codigo, filtrado por empresa
  supervisor:       number        -- FK -> cartera.t_supervisor.codigo, filtrado por empresa+proyecto
  codigo:           number        -- parte del PK, gestionado por la base de datos.
  nombre:           string
  activo:           smallint      -- 1 = activo, 0 = inactivo
  agrego_usuario:   uuid          -- gestionado por sistema
  agrego_fecha:     timestamptz   -- gestionado por sistema
  modifico_usuario: uuid          -- gestionado por sistema
  modifico_fecha:   timestamptz   -- token de concurrencia optimista
}

CoordinadorForm {          	-- campos editables por el usuario
  empresa:        number
  proyecto:       number
  nombre:         string
  supervisor:     number
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
getSupervisores()     -> prop 'supervisores' -> alimenta el Select de supervisores (filtrado por empresa+proyecto)

Cascade triple: empresa → proyecto → supervisor.
- Al cambiar empresa: resetear proyecto al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0, resetear supervisor al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0.
- Al cambiar proyecto: resetear supervisor al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0.

```
> `getEmpresas`, `getProyectos` y `getSupervisores` aplican `.eq('cuenta', cuenta)` internamente — el campo `cuenta` no aparece en ningún Select ni prop visible.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `nombre`, `supervisor`, `activo`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

### Mapeo de permisos a UI

Ver regla general en `crud-screens.instructions.md` → sección **Permission mapping to UI**.

```ts
const permisos = await getPermisosDetalle(PERMISOS.COO_CAT)
// pasar como props: puedeAgregar={permisos.agregar} puedeModificar={permisos.modificar} puedeEliminar={permisos.eliminar}

```

## EXPORTACION

Ver regla general en `data-tables.instructions.md` → sección **CSV Export**.

**Nombre de archivo:** `coordinadores-YYYY-MM-DD.csv`

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
`STORAGE_KEY = 'coordinadores_cols_v1_${userId}'`

> **Regla para FKs en la tabla:** nunca mostrar el ID numerico. Resolver al nombre legible:
> `empresa` → nombre de la empresa (prop `empresas`); `proyecto` → nombre del proyecto (prop `proyectos`);
> `supervisor` → nombre del supervisor (prop `supervisores`).

| key            | label           | defaultVisible | render                                                |
|----------------|-----------------|----------------|-------------------------------------------------------|
| empresa        | Empresa         | false          | nombre de la empresa (del prop `empresas`)            |
| proyecto       | Proyecto        | true           | nombre del proyecto (del prop `proyectos`)            |
| nombre         | Nombre          | true           | valor directo                                         |
| supervisor     | Supervisor      | false          | nombre del supervisor (del prop `supervisores`)       |
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

| Campo      | Label      | Ancho | View          | Nuevo / Edit                                | Notas |
|------------|------------|-------|---------------|---------------------------------------------|-------|
| supervisor | Supervisor | full  | ViewField     | Select; supervisoresFiltrados empresa+proy  |       |
| nombre     | Nombre     | full  | ViewField     | Input; req                                  |       |
| activo     | Activo     | full  | Checkbox card | Checkbox 0/1                                |       |

---

## REGLAS_ESPECIFICAS

1. `codigo` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `nombre` dentro del mismo `(cuenta, empresa, proyecto)`. Validar en backend antes del INSERT con `.eq('cuenta', cuenta).eq('empresa', ...).eq('proyecto', ...).eq('nombre', ...)`.
3. **Validacion de similitud de nombre (frontend):** antes de llamar a `doSave()`, comparar el nombre ingresado
   contra todos los coordinadores del mismo `(empresa, proyecto)` usando `jaroWinkler(toDbString(form.nombre), toDbString(x.nombre)) >= 0.85` (importar `jaroWinkler, toDbString` de `@/lib/utils`). Si hay coincidencias, mostrar un `AlertDialog` que lista los nombres similares y pregunta al usuario si desea continuar. El boton de confirmacion dice `"Si, es diferente — Continuar"` y llama a `doSave()`. Al editar, excluir el propio registro del analisis (`x.codigo !== viewTarget.codigo`).
4. Mostrar advertencia si `proyectos.length === 0` deshabilitar el boton "Nuevo Coordinador".

---

## VALIDACIONES_BACKEND

- Duplicado: `nombre` ya existe en el mismo `(cuenta, empresa, proyecto)` -> `'Ya existe un coordinador con ese nombre en este proyecto.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en `cartera.t_vendedor` con el mismo `(cuenta, empresa, proyecto, coordinador)`. Si existen -> `'No se puede eliminar este coordinador porque tiene vendedores asociados.'`. La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## UI_ESPECIFICO

> Aplicar **Accent patterns** de `ui-conventions.instructions.md` usando el color de acento del modulo.

> La estructura de pestanas y secciones del modal esta definida en `TABS_MODAL`.

---

## LOGIC_ESPECIFICO

- Cascadas en `f()`: ver seccion **RELACIONES** para el detalle completo de cada cascada.
- `openCreate()`: pre-seleccionar primera empresa, primer proyecto de esa empresa y primer supervisor de ese proyecto.

---

## QUERIES_TABLA

No requiere RPC ni queries especiales. Orden: `.order('empresa').order('proyecto').order('nombre')`.

---

## USA_ESTRICTAMENTE

Leer todos los archivos de instrucciones listados en la sección **"Instrucciones de arquitectura específicas del proyecto"** de `.github/copilot-instructions.md`.

---

## ARCHIVOS_SALIDA

Exactamente tres archivos, en este orden:

1. `src/app/actions/coordinadores.ts`
   Funciones: `getCuentaActiva` (privada), `getAuditUser` (privada), `writeAudit` (privada),
   `getCoordinadores`, `createCoordinador`, `updateCoordinador`, `deleteCoordinador`.

2. `src/app/dashboard/promesas/coordinadores/page.tsx`
   Server Component. Usar `Promise.all` con per-call `.catch()` segun patron de `server-actions.instructions.md`.

3. `src/app/dashboard/promesas/coordinadores/_client.tsx`
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
