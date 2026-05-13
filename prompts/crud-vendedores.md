# CRUD: Vendedores

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Vendedores                                                   |
| MODULO         | Promesas                                                     |
| TABLA_BD       | `cartera.t_vendedor`                                         |
| RUTA           | `/dashboard/promesas/vendedores`                             |
| PERMISO        | `VEN_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota_   |
| MODO           | nuevo                                                        |

---

## MODO_GUARD

> [!CAUTION]
> **Antes de generar cualquier archivo:** verificar si `src/app/dashboard/promesas/vendedores/page.tsx` ya existe en el repositorio.
> - **Si existe** → **DETENER. Preguntar al desarrollador** si desea sobrescribir. No continuar hasta recibir confirmación explícita de que sí.
> - **Si no existe** → continuar con el procedimiento normal.
>
> Esta verificación se omite únicamente si `MODO = actualizar`.

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de vendedores.
Cada proyecto puede trabajar con varios vendedores.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_vendedor`. Los tipos deben coincidir con la BD.

```
Vendedor {
  cuenta:           varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:          number        -- FK -> cartera.t_empresa.codigo
  proyecto:         number        -- FK -> cartera.t_proyecto.codigo, filtrado por empresa
  coordinador:      number        -- FK -> cartera.t_coordinador.codigo, filtrado por empresa+proyecto
  codigo:           number        -- parte del PK, gestionado por la base de datos.
  nombre:           string
  activo:           smallint      -- 1 = activo, 0 = inactivo
  agrego_usuario:   uuid          -- gestionado por sistema
  agrego_fecha:     timestamptz   -- gestionado por sistema
  modifico_usuario: uuid          -- gestionado por sistema
  modifico_fecha:   timestamptz   -- token de concurrencia optimista
}

VendedorForm {          	-- campos editables por el usuario
  empresa:        number
  proyecto:       number
  nombre:         string
  coordinador:    number
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
getCoordinador()    -> prop 'coordinadores'  -> alimenta el Select de coordinadores (filtrado por empresa+proyecto)

Cascade triple: empresa → proyecto → coordinador.
- Al cambiar empresa: resetear proyecto al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0, resetear coordinador al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0.
- Al cambiar proyecto: resetear coordinador al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0.

```
> `getEmpresas`, `getProyectos` y `getCoordinadores` aplican `.eq('cuenta', cuenta)` internamente — el campo `cuenta` no aparece en ningún Select ni prop visible.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `nombre`, `coordinador`, `activo`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

## EXPORTACION

**Nombre de archivo:** `vendedores-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `codigo` (label: `"Codigo"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

Sticky izquierdo: `codigo` (label: `"Codigo"`, es el identificador visible del PK).
`STORAGE_KEY = 'vendedores_cols_v1_${userId}'`

> **Regla para FKs en la tabla:** nunca mostrar el ID numerico. Resolver al nombre legible:
> `empresa` → nombre de la empresa (prop `empresas`); `proyecto` → nombre del proyecto (prop `proyectos`);
> `coordinador` → nombre del coordinador (prop `coordinadores`).

| key            | label           | defaultVisible | render                                                |
|----------------|-----------------|----------------|-------------------------------------------------------|
| empresa        | Empresa         | false          | nombre FK (prop `empresas`)                           |
| proyecto       | Proyecto        | true           | nombre FK (prop `proyectos`)                          |
| nombre         | Nombre          | true           | valor directo                                         |
| coordinador    | Coordinador     | false          | nombre FK (prop `coordinadores`)                      |
| activo         | Activo          | true           | Badge activo [§Y]                                      |

---

## TABS_MODAL

### Tab: General  (icono: MapPin)

**[IDENTIFICACION]**

| Campo    | Label    | Ancho | View      | Nuevo       | Edit             | Default (Nuevo)    | Notas |
|----------|----------|-------|-----------|-------------|------------------|--------------------|-------|
| empresa  | Empresa  | full  | ViewField | Select FK [§F]; req | Select FK [§F]; disabled | primera disponible | prop `empresas` |
| proyecto | Proyecto | full  | ViewField | Select FK [§F]; req | Select FK [§F]; disabled | primero de empresa | prop `proyectos` |
| codigo   | Codigo   | full  | ViewField | —                   | —                        | — (auto-asignado)  |                 |

**[GENERAL]**

| Campo      | Label      | Ancho | View          | Nuevo / Edit                                | Default (Nuevo)    | Notas |
|------------|------------|-------|---------------|---------------------------------------------|--------------------| ------|
| coordinador| Coordinador| full  | ViewField         | Select FK [§F]; req | primero disponible | prop `coordinadores`; filtrado por empresa+proyecto |
| nombre     | Nombre     | full  | ViewField         | Input [§D]; req    | ''                 |                                                     |
| activo     | Activo     | full  | Badge activo [§Y] | Checkbox [§I]      | 1                  |                                                     |

---

## REGLAS_ESPECIFICAS

1. `codigo` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `nombre` dentro del mismo `(cuenta, empresa, proyecto)`. Validar en backend antes del INSERT con `.eq('cuenta', cuenta).eq('empresa', ...).eq('proyecto', ...).eq('nombre', ...)`.
3. **Validacion de similitud de nombre (frontend):** antes de llamar a `doSave()`, comparar el nombre ingresado contra todos los vendedores del mismo `(empresa, proyecto)` usando `jaroWinkler(toDbString(form.nombre), toDbString(x.nombre)) >= 0.85` (importar `jaroWinkler, toDbString` de `@/lib/utils`). Si hay coincidencias, mostrar un `AlertDialog` que lista los nombres similares y pregunta al usuario si desea continuar. El boton de confirmacion dice `"Si, es diferente — Continuar"` y llama a `doSave()`. Al editar, excluir el propio registro del analisis (`x.codigo !== viewTarget.codigo`).
4. Mostrar advertencia si `proyectos.length === 0` deshabilitar el boton "Nuevo Vendedor".

---

## VALIDACIONES_BACKEND

- Duplicado: `nombre` ya existe en el mismo `(cuenta, empresa, proyecto)` -> `'Ya existe un vendedor con ese nombre en este proyecto.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en `cartera.t_promesa` con el mismo `(cuenta, empresa, proyecto, vendedor)`. Si existen -> `'No se puede eliminar este vendedor porque tiene promesas asociadas.'`. La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en `cartera.t_reserva` con el mismo `(cuenta, empresa, proyecto, vendedor)`. Si existen -> `'No se puede eliminar este vendedor porque tiene reservas asociadas.'`. La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## LOGIC_ESPECIFICO

- Cascadas en `f()`: ver seccion **RELACIONES** para el detalle completo de cada cascada.
- `openCreate()`: pre-seleccionar primera empresa, primer proyecto de esa empresa y primer coordinador de ese proyecto.

---

## QUERIES_TABLA

No requiere RPC ni queries especiales. Orden: `.order('empresa').order('proyecto').order('nombre')`.

---

## CAMBIOS_PENDIENTES

> Solo se aplica cuando `MODO = actualizar`. Describe el delta exacto a aplicar sobre los archivos ya existentes.
> Vaciar esta sección (dejar solo esta instrucción) después de aplicar los cambios y devolver `MODO` a `nuevo`.
> Ejemplo de como se deberia especificar puntualmente los cambios realizados:
> [ENTIDAD] Agregar campo `campoXX` (string) a `EstructuraForm`
> [TABS_MODAL / General / GENERAL] Agregar fila: campoXX | Lable | half | ViewField | Input |
> [COLUMNAS_TABLA] Agregar columna `campoXX`, defaultVisible=false

_(sin cambios pendientes)_
