# CRUD: Lotes

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Lotes                                                        |
| MODULO         | Proyectos                                                    |
| TABLA_BD       | `cartera.t_lote`                                             |
| RUTA           | `/dashboard/proyectos/lotes`                                 |
| PERMISO        | `LOT_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota)_  |
| MODO           | nuevo                                                        |

---

## MODO_GUARD

> [!CAUTION]
> **Antes de generar cualquier archivo:** verificar si `src/app/dashboard/proyectos/lotes/page.tsx` ya existe en el repositorio.
> - **Si existe** → **DETENER. Preguntar al desarrollador** si desea sobrescribir. No continuar hasta recibir confirmación explícita de que sí.
> - **Si no existe** → continuar con el procedimiento normal.
>
> Esta verificación se omite únicamente si `MODO = actualizar`.

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de Lotes.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_lote`. Los tipos deben coincidir con la BD.

```
Lote {
  cuenta:                   varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:                  number        -- FK -> cartera.t_empresa.codigo
  proyecto:                 number        -- FK -> cartera.t_proyecto.codigo, filtrado por empresa
  fase:                     number        -- FK -> cartera.t_fase.codigo, filtrado por proyecto
  manzana:                  string        -- FK -> cartera.t_manzana.codigo, filtrado por fase
  codigo:                   string        -- parte del PK, ingresado por el usuario
  moneda:                   string        -- FK -> t_moneda
  valor:                    numerico      -- mayor o igual a 0.00
  finca:                    string        -- registro de finca
  folio:                    string        -- registro de folio
  libro:                    string        -- registro de libro
  extension:                numeric       -- mayor o igual a 0.00
  norte:                    string        -- colindancia norte
  sur:                      string        -- colindancia sur
  este:                     string        -- colindancia este
  oeste:                    string        -- colindancia oeste
  otro:                     string        -- colindancia otros
  promesa:                  number        -- FK -> t_promesa (valor puede ser 0)
  recibo_serie:             string        -- FK -> t_serie_recibo (valor puede ser blanco/null)
  agrego_usuario:           uuid          -- gestionado por sistema
  agrego_fecha:             timestamptz   -- gestionado por sistema
  modifico_usuario:         uuid          -- gestionado por sistema
  modifico_fecha:           timestamptz   -- token de concurrencia optimista
}

LoteForm {          	-- campos editables por el usuario
  empresa:                    number
  proyecto:                   number
  fase:                       number
  manzana:                    string
  codigo:                     string
  moneda:                     string
  valor:                      numeric
  finca:                      string
  folio:                      string
  libro:                      string
  extension:                  numeric
  norte:                      string
  sur:                        string
  este:                       string
  oeste:                      string
  otro:                       string
}

```

**LLAVE_PRIMARIA compuesta:** `(cuenta, empresa, proyecto, fase, manzana, codigo)`
- `cuenta` es implicito (se obtiene del usuario autenticado, no va en el form)
- Para UPDATE y DELETE identificar por: `empresa + proyecto + fase + manzana + codigo`
- `empresa`, `proyecto`, `fase` y `manzana` son readonly tras creacion: no incluir en el payload del UPDATE.

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getEmpresas()       -> prop 'empresas'       -> alimenta el Select de empresa
getProyectos()      -> prop 'proyectos'      -> alimenta el Select de proyecto (filtrado por empresa)
getFases()          -> prop 'fases'          -> alimenta el Select de fases (filtrado por proyecto)
getManzanas()       -> prop 'manzanas'       -> alimenta el Select de manzanas (filtrado por fases)
getMonedas()        -> prop 'monedas'        -> alimenta el Select de monedas (catalogo global)

> **Unidad de extension:** el campo `t_fase.medida` (ej. `m²`, `vara²`, `ft²`) es la unidad de medida
> de los lotes de esa fase. Se obtiene de `fases.find(f => f.codigo === lote.fase)?.medida`.
> Se usa como sufijo no editable junto al campo `extension` en la tabla, en ViewField y en el Input de edicion.

Cascada: empresa → proyecto → fase → manzana.
- Al cambiar empresa: resetear proyecto al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0. Luego resetear fase a la primera disponible, y si no hubiera una resetear en blanco con valor 0. Luego resetear manzana a la primera disponible, y si no hubiera una resetear a blanco.

Cascada: proyecto → fase → manzana.
- Al cambiar poryecto: resetear fase a la primera disponible, y si no hubiera una resetear en blanco con valor 0. Luego resetear manzana a la primera disponible, y si no hubiera una resetear a blanco.

Cascada: fase → manzana.
- Al cambiar fase: resetear manzana a la primera disponible, y si no hubiera una resetear a blanco.

```
> `getEmpresas`, `getProyectos`, `getFases` y `getManzanas` aplican `.eq('cuenta', cuenta)` internamente — el campo `cuenta` no aparece en ningún Select ni prop visible.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `moneda`, `valor`, `finca`, `folio`, `libro`, `extension`, `norte`, `sur`, `este`, `oeste`, `otro`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

## EXPORTACION

**Nombre de archivo:** `lotes-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `codigo` (label: `"Codigo"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

Sticky izquierdo: `codigo` (label: `"Codigo"`, es el identificador visible del PK).
`STORAGE_KEY = 'lotes_cols_v1_${userId}'`

> **Regla para FKs en la tabla:** nunca mostrar el ID numerico. Resolver al nombre legible:
> `empresa` → nombre de la empresa (prop `empresas`); 
> `proyecto` → nombre del proyecto (prop `proyectos`);
> `fase` → nombre de la fase (prop `fases`);
> `moneda` → bandera + ISO segun **Moneda display rules** de `ui-conventions.instructions.md`.

| key                         | label           | defaultVisible | render                                                |
|-----------------------------|-----------------|----------------|-------------------------------------------------------|
| empresa                     | Empresa         | false          | nombre de la empresa (del prop `empresas`)            |
| proyecto                    | Proyecto        | true           | nombre del proyecto (del prop `proyectos`)            |
| fase                        | Fase            | true           | nombre de la fase (del prop `fases`)                  |
| manzana                     | Manzana         | true           | valor directo                                         |
| moneda                      | Moneda          | true           | bandera + ISO (Moneda display rules)                  |
| valor                       | Precio          | true           | `fmt(valor)` — 2 decimales, locale es-GT              |
| finca                       | Finca           | false          | valor directo                                         |
| libro                       | Libro           | false          | valor directo                                         |
| folio                       | Folio           | false          | valor directo                                         |
| extension                   | Extension       | true           | `fmt(extension, 2) + ' ' + fases.find(f=>f.codigo===lote.fase)?.medida` |
| norte                       | Norte           | false          | valor directo                                         |
| sur                         | Sur             | false          | valor directo                                         |
| este                        | Este            | false          | valor directo                                         |
| oeste                       | Oeste           | false          | valor directo                                         |
| otro                        | Otro            | false          | valor directo                                         |
| estado                      | Estado          | true           | `getLoteEstado(lote.promesa, lote.recibo_numero)` — `<Badge variant={LOTE_ESTADO_BADGE[estado].variant} className={LOTE_ESTADO_BADGE[estado].className}>` (importar `getLoteEstado, LOTE_ESTADO_BADGE` de `@/lib/constants`) |

---

## TABS_MODAL

### Tab: General  (icono: MapPin)

**[IDENTIFICACION]**

| Campo    | Label    | Ancho | View      | Nuevo       | Edit             | Default (Nuevo)     | Notas |
|----------|----------|-------|-----------|-------------|------------------|---------------------|-------|
| empresa  | Empresa  | full  | ViewField | Select; req | Select; disabled | primera disponible  |       |
| proyecto | Proyecto | full  | ViewField | Select; req | Select; disabled | primero de empresa  |       |
| fase     | Fase     | half  | ViewField | Select; req | Select; disabled | primera de proyecto |       |
| manzana  | Manzana  | half  | ViewField | Select; req | Select; disabled | primera de fase     |       |
| codigo   | Codigo   | half  | ViewField | —           | —                | ''                  |       |

**[GENERAL]**

| Campo                    | Label           | Ancho | View           | Nuevo / Edit                                  | Default (Nuevo)                   | Notas                    |
|--------------------------|-----------------|-------|----------------|-----------------------------------------------|-----------------------------------|--------------------------|
| moneda                   | Moneda          | half  | Moneda display | Select desde prop 'monedas'; req              | COUNTRY_CURRENCY_MAP → monedas[0] | ver Moneda display rules |
| valor                    | Valor           | half  | ViewField      | Input numeric; req                            | 0                                 |                          |
| extension                | Extension       | half  | ViewField: `{extension} {medida}` | Input numeric con sufijo `medida`; req | 0                      | `medida` = `fases.find(f => f.codigo === form.fase)?.medida ?? ''`. Mostrar como texto no editable a la derecha del input (adornment). En ViewField concatenar: `String(viewTarget.extension) + ' ' + medida`. |

### Tab: Otros  (icono: Receipt)

**[REGISTRO]**

| Campo                    | Label           | Ancho | View          | Nuevo / Edit                           | Default (Nuevo) | Notas                                    |
|--------------------------|-----------------|-------|---------------|----------------------------------------|-----------------|------------------------------------------|
| finca                    | Finca           | half  | ViewField     | Input                                  | ''              |                                          |
| folio                    | Folio           | half  | ViewField     | Input                                  | ''              |                                          |
| libro                    | libro           | half  | ViewField     | Input                                  | ''              |                                          |

**[COLINDANCIAS]**

| Campo                    | Label           | Ancho | View          | Nuevo / Edit                           | Default (Nuevo) | Notas                                    |
|--------------------------|-----------------|-------|---------------|----------------------------------------|-----------------|------------------------------------------|
| norte                    | Norte           | half  | ViewField     | Input                                  | ''              |                                          |
| sur                      | Sur             | half  | ViewField     | Input                                  | ''              |                                          |
| este                     | Este            | half  | ViewField     | Input                                  | ''              |                                          |
| oeste                    | Oeste           | half  | ViewField     | Input                                  | ''              |                                          |
| otros                    | Otros           | half  | ViewField     | Input                                  | ''              |                                          |

### Tab: Promesas  (icono: ClipboardList)  — solo en modal Ver

**[RESERVA]**

| Campo                       | Label   | Ancho | View      | Nuevo | Edit | Notas                                                                            |
|-----------------------------|---------|-------|-----------|-------|------|----------------------------------------------------------------------------------|
| reserva                     | Reserva | third | ViewField | -     | -    | se llena si `recibo_numero > 0`: `reserva` desde `t_recibo_caja` via `getLoteReservaNumero`   |
| recibo_serie+recibo_numero  | Recibo | third | ViewField  | -     | -    | se llena si `recibo_numero > 0`: concatenar `recibo_serie` + `recibo_numero` del lote |
| fecha                       | Fecha  | third | ViewField  | -     | -    | se llena si `recibo_numero > 0`: `fecha` desde `t_recibo_caja` via `getLoteReservaInfo` |
| cliente_nombre              | Cliente | full | ViewField  | -     | -    | se llena si `recibo_numero > 0`: `nombre` desde `t_cliente` via `getLoteReservaInfo` |

---

## REGLAS_ESPECIFICAS

1. `codigo` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `codigo` dentro del mismo `(cuenta, empresa, proyecto, fase, manzana)`. Validar en backend antes del INSERT con `.eq('cuenta', cuenta).eq('empresa', ...).eq('proyecto', ...).eq('fase', ...).eq('manzana', ...).eq('codigo', ...)`.
3. Mostrar advertencia si `manzana.length === 0` deshabilitar el boton "Nuevo Lote".

---

## VALIDACIONES_BACKEND

- Duplicado: `codigo` ya existe en el mismo `(cuenta, empresa, proyecto, fase, manzana)` -> `'Ya existe un lote con ese codigo en esta manzana.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en:
   1. `cartera.t_promesa` con el mismo `(cuenta, empresa, proyecto, fase, manzana)`. Si existen -> `'No se puede eliminar este lote porque tiene promesas asociadas.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.
   2. `cartera.t_reserva` con el mismo `(cuenta, empresa, proyecto, fase, manzana)`. Si existen -> `'No se puede eliminar este lote porque tiene reservas asociadas.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.
   3. `cartera.t_recibo_caja` con el mismo `(cuenta, empresa, proyecto, fase, manzana)`. Si existen -> `'No se puede eliminar este lote porque tiene recibos asociados.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## LOGIC_ESPECIFICO

- Cascadas en `f()`: ver seccion **RELACIONES** para el detalle completo de cada cascada.
- **Estado del lote (campo virtual):** no existe en la BD. Se deriva en el cliente con `getLoteEstado(lote.promesa, lote.recibo_numero)` (importar de `@/lib/constants`):
  - `promesa > 0` → **Vendido**
  - `promesa === 0 && recibo_numero > 0` → **Reservado**
  - `promesa === 0 && recibo_numero === 0` → **Disponible**
  El estado no forma parte de `LoteForm` ni de ningún UPDATE — es solo presentación.
- **Unidad de extension (medida):** derivar `medida` reactivamente como `fases.find(f => f.codigo === form.fase)?.medida ?? ''`. Usar en: sufijo del Input de `extension` en modo edicion/creacion, y en `ViewField` de `extension` en modo vista. No almacenar en el form — es solo presentacion.
- `openCreate()`: pre-seleccionar primera empresa y primer proyecto de esa empresa **Y** pre-seleccionar `moneda` usando el algoritmo de **Currency pre-selection from country** de `ui-conventions.instructions.md`: detectar el pais por proyecto → empresa → IP (ver **Country / Geo pre-selection** en `crud-screens.instructions.md`) y convertirlo a moneda con `COUNTRY_CURRENCY_MAP` de `@/lib/constants`. Si no existe match, usar `monedas[0].codigo` como fallback.

---

## QUERIES_TABLA

No requiere RPC ni queries especiales. Orden: `.order('empresa').order('proyecto').order('fase').order('manzana').order('codigo')`.

---

## CAMBIOS_PENDIENTES

> Solo se aplica cuando `MODO = actualizar`. Describe el delta exacto a aplicar sobre los archivos ya existentes.
> Vaciar esta sección (dejar solo esta instrucción) después de aplicar los cambios y devolver `MODO` a `nuevo`.
> Ejemplo de como se deberia especificar puntualmente los cambios realizados:
> [ENTIDAD] Agregar campo `campoXX` (string) a `EstructuraForm`
> [TABS_MODAL / General / GENERAL] Agregar fila: campoXX | Lable | half | ViewField | Input |
> [COLUMNAS_TABLA] Agregar columna `campoXX`, defaultVisible=false

 _(sin cambios pendientes)_
