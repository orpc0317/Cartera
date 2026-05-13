# CRUD: Manzanas

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Manzanas                                                     |
| MODULO         | Manzanas                                                     |
| TABLA_BD       | `cartera.t_manzana`                                          |
| RUTA           | `/dashboard/proyectos/manzanas`                              |
| PERMISO        | `MAN_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota)_  |
| MODO           | nuevo                                                        |

---

## MODO_GUARD

> [!CAUTION]
> **Antes de generar cualquier archivo:** verificar si `src/app/dashboard/proyectos/manzanas/page.tsx` ya existe en el repositorio.
> - **Si existe** → **DETENER. Preguntar al desarrollador** si desea sobrescribir. No continuar hasta recibir confirmación explícita de que sí.
> - **Si no existe** → continuar con el procedimiento normal.
>
> Esta verificación se omite únicamente si `MODO = actualizar`.

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de Manzanas.
Cada Fase de un Proyecto se divide en Manzanas y estas se van a dividir en Lotes.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_manzana`. Los tipos deben coincidir con la BD.

```
manzana {
  cuenta:           varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:          number        -- FK -> cartera.t_empresa.codigo
  proyecto:         number        -- FK -> cartera.t_proyecto.codigo, filtrado por empresa
  fase:             number        -- FK -> cartera.t_fase.codigo, filtrado por proyecto
  codigo:           string        -- parte del PK, ingresado por el usuario.
  agrego_usuario:   uuid          -- gestionado por sistema
  agrego_fecha:     timestamptz   -- gestionado por sistema
  modifico_usuario: uuid          -- gestionado por sistema
  modifico_fecha:   timestamptz   -- token de concurrencia optimista
}

ManzanaForm {              	       -- campos editables por el usuario
  empresa:        number
  proyecto:       number
  fase:           number
  codigo:         string
}

```

**LLAVE_PRIMARIA compuesta:** `(cuenta, empresa, proyecto, fase, codigo)`
- `cuenta` es implicito (se obtiene del usuario autenticado, no va en el form)
- Para UPDATE y DELETE identificar por: `empresa + proyecto + fase + codigo`
- `empresa`, `proyecto` y `fase` son readonly tras creacion: no incluir en el payload del UPDATE.

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getEmpresas()       -> prop 'empresas'       -> alimenta el Select de empresa
getProyectos()      -> prop 'proyectos'      -> alimenta el Select de proyecto (filtrado por empresa)

Cascade tripe: empresa → proyecto → fase.
- Al cambiar empresa: resetear proyecto al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0. Luego resetear fase a la primera disponible, y si no hubiera una disponible resetear en blanco con valor 0.
- Al cambiar proyecto: resetear fase a la primera disponible, y si no hubiera una disponible resetear en blanco con valor 0.

```

> `getEmpresas`, `getProyectos` y `getFases` aplican `.eq('cuenta', cuenta)` internamente — el campo `cuenta` no aparece en ningún Select ni prop visible.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE) — no se puede editar ningun campo
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

## EXPORTACION

**Nombre de archivo:** `manzanas-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `codigo` (label: `"Codigo"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

Sticky izquierdo: `codigo` (label: `"Codigo"`, es el identificador visible del PK).
`STORAGE_KEY = 'manzanas_cols_v1_${userId}'`

> **Regla para FKs en la tabla:** nunca mostrar el ID numerico. Resolver al nombre legible:
> `empresa` → nombre de la empresa (prop `empresas`); `proyecto` → nombre del proyecto (prop `proyectos`).

| key            | label           | defaultVisible | render                                               |
|----------------|-----------------|----------------|------------------------------------------------------|
| empresa        | Empresa         | false          | nombre FK (prop `empresas`)                          |
| proyecto       | Proyecto        | true           | nombre FK (prop `proyectos`)                         |
| fase           | Fase            | true           | nombre FK (prop `fases`)                             |
| codigo         | Codigo          | true           | valor directo                                        |

---

## TABS_MODAL

### Tab: General  (icono: MapPin)

**[IDENTIFICACION]**

| Campo    | Label    | Ancho | View      | Nuevo       | Edit             | Default (Nuevo)     | Notas |
|----------|----------|-------|-----------|-------------|------------------|---------------------|-------|
| empresa  | Empresa  | full  | ViewField | Select FK [§F]; req | Select FK [§F]; disabled | primera disponible  | prop `empresas` |
| proyecto | Proyecto | full  | ViewField | Select FK [§F]; req | Select FK [§F]; disabled | primero de empresa  | prop `proyectos` |
| fase     | Fase     | half  | ViewField | Select FK [§F]; req | Select FK [§F]; disabled | primera de proyecto | prop `fases`; filtrado por proyecto |
| codigo   | Codigo   | half  | ViewField | Input [§D]; req     | —                        | ''                  |                 |

---

## REGLAS_ESPECIFICAS

1. `codigo` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `codigo` dentro del mismo `(cuenta, empresa, proyecto, fase)`. Validar en backend antes del INSERT con `.eq('cuenta', cuenta).eq('empresa', ...).eq('proyecto', ...).eq('fase', ...).eq('codigo', ...)`.
3. Mostrar advertencia si `proyectos.length === 0` y deshabilitar el boton "Nueva Manzana".

---

## VALIDACIONES_BACKEND

- Duplicado: `codigo` ya existe en el mismo `(cuenta, empresa, proyecto, fase)` -> `'Ya existe una manzana con ese codigo en esta fase.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en `cartera.t_lote` con el mismo `(cuenta, empresa, proyecto, fase, manzana)`. Si existen -> `'No se puede eliminar esta manzana porque tiene lotes asociados.'`. La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## LOGIC_ESPECIFICO

- Cascadas en `f()`: ver seccion **RELACIONES** para el detalle completo de cada cascada.
- `openCreate()`: pre-seleccionar primera empresa y primer proyecto de esa empresa.

---

## QUERIES_TABLA

No requiere RPC ni queries especiales. Orden: `.order('empresa').order('proyecto').order('fase').order('codigo')`.

---

## CAMBIOS_PENDIENTES

> Solo se aplica cuando `MODO = actualizar`. Describe el delta exacto a aplicar sobre los archivos ya existentes.
> Vaciar esta sección (dejar solo esta instrucción) después de aplicar los cambios y devolver `MODO` a `nuevo`.
> Ejemplo de como se deberia especificar puntualmente los cambios realizados:
> [ENTIDAD] Agregar campo `campoXX` (string) a `EstructuraForm`
> [TABS_MODAL / General / GENERAL] Agregar fila: campoXX | Lable | half | ViewField | Input |
> [COLUMNAS_TABLA] Agregar columna `campoXX`, defaultVisible=false

_(sin cambios pendientes)_