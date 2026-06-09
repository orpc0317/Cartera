# CRUD: Promesas

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Promesa                                                      |
| MODULO         | Promesas                                                     |
| TABLA_BD       | `cartera.t_promesa`                                          |
| RUTA           | `/dashboard/promesas/promesas`                               |
| PERMISO        | `PRO_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota)_  |
| MODAL_LAYOUT   | ancho                                              |
| MODO           | nuevo                                                        |

---

## MODO_GUARD

> [!CAUTION]
> **Antes de generar cualquier archivo:** verificar si `src/app/dashboard/promesas/promesa/page.tsx` ya existe en el repositorio.
> - **Si existe** → **DETENER. Preguntar al desarrollador** si desea sobrescribir. No continuar hasta recibir confirmación explícita de que sí.
> - **Si no existe** → continuar con el procedimiento normal.
>
> Esta verificación se omite únicamente si `MODO = actualizar`.

---

## DESCRIPCION

Pantalla para dar mantenimiento a las Promesas de Compra-Venta.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_promesa`. Los tipos deben coincidir con la BD.

```
Promesa {
  cuenta:                   varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:                  number        -- FK -> cartera.t_empresa.codigo
  proyecto:                 number        -- FK -> cartera.t_proyecto.codigo, filtrado por empresa
  numero:                   number        -- parte del PK; asignado automáticamente por trigger si t_proyecto.promesa_correlativo = 1; ingresado por el usuario si = 0
  referencia:               string        -- numero externo de contrato
  fecha:                    date          -- fecha promesa
  cliente:                  number        -- FK -> cartera.t_cliente.codigo, filtrado por proyecto
  vendedor:                 number        -- FK -> cartera.t_cliente.codigo, filtrado por proyecto
  fase:                     number        -- FK -> cartera.t_fase.codigo, filtrado por proyecto
  manzana:                  string        -- FK -> cartera.t_manzana.codigo, filtrado por fase
  lote:                     string        -- FK -> cartera.t_lote.codigo, filtrado por manzana
  moneda:                   string        -- heredado de la moneda en cartera.t_lote
  valor_lote:               numeric       -- heredado del precio de venta en cartera.t_lote
  subsidio:                 numeric       -- subsidio al precio del lote (valor puede ser mayor o igual a 0.00, nunca puede ser mayor al valor del lote) 
  arras:                    numeric       -- valor de arras (valor puede ser mayor o igual a 0.00, nunca puede ser mayor al saldo de (valor del lote - subsidio))
  monto_enganche:           numeric       -- valor de enganche (valor puede ser mayor o igual a 0.00, nunca puede ser mayor al saldo de (valor del lote - subsidio))
  primer_enganche:          numeric       -- valor de la primera cuota de enganche (valor puede ser mayor o igual a 0.00, nunca puede ser mayor al monto enganche)
  plazo_enganche:           numeric       -- numero de cuotas para pagar el enganche, no puede ser 0 si monto enganche es mayor a 0.00
  interes_anual:            numeric       -- porcentaje de interes anual, puede ser mayor o igual a 0.00
  forma_mora:               smallint      -- indica la forma de calculo de la mora (0 mensual, 1 diario)
  interes_mora:             numeric       -- porcentaje de interes mensual por mora, puede ser mayor o igual a 0.00
  fijo_mora:                numeric       -- valor mora fijo, puede ser mayor o igual a 0.00
  mora_enganche:            smallint      -- indica si hay que calcular mora al enganche
  dias_gracia:              numeric       -- indica los dias de gracia antes de calcular mora
  dias_afectos:              smallint      -- indica los dias afectos a mora (0 todos los dias, 1 un mes)
  forma_financiamiento:     smallint      -- indica la forma de financiamiento (1 cuota nivelada)
  fecha_financiamiento:     date          -- fecha de la primera cuota del financiamiento; label UI: "1era Cuota"
  monto_financiamiento:     numeric       -- monto a financiar, puede ser mayor o igual a 0.00, su valor inicial es monto lote - monto enganche
  plazo_financiamiento:     numeric       -- numero de cuotas para pagar el financiamiento, no puede ser 0 si monto financiamiento es mayor a 0.00
  fecha_cancelacion:        date          -- fecha en que la promesa se cancelo (se termino de pagar)
  venta:                    smallint      -- indica si la promesa representa una venta nueva (0 no, 1 si)
  observacion:              string        -- observaciones
  estado:                   smallint      -- indica el estado de la promesa (1 vigente, 2 pagada, 3 anulada)
  agrego_usuario:           uuid          -- gestionado por sistema
  agrego_fecha:             timestamptz   -- gestionado por sistema
  modifico_usuario:         uuid          -- gestionado por sistema
  modifico_fecha:           timestamptz   -- token de concurrencia optimista
}

PromesaForm {          	    -- campos editables por el usuario
  empresa:                  number
  proyecto:                 number
  numero:                   number
  referencia:               string
  fecha:                    date
  cliente:                  number
  vendedor:                 number
  fase:                     number
  manzana:                  string
  lote:                     string
  moneda:                   string
  valor_lote:               numeric
  subsidio:                 numeric
  arras:                    numeric
  monto_enganche:           numeric
  primer_enganche:          numeric
  plazo_enganche:           numeric
  interes_anual:            numeric
  forma_mora:               smallint
  interes_mora:             numeric
  fijo_mora:                numeric
  mora_enganche:            smallint
  dias_gracia:              numeric
  dias_afectos:              smallint
  forma_financiamiento:     smallint
  fecha_financiamiento:     date
  monto_financiamiento:     numeric
  plazo_financiamiento:     numeric
  fecha_cancelacion:        date
  venta:                    smallint
  observacion:              string
  estado:                   smallint
}

```

**LLAVE_PRIMARIA compuesta:** `(cuenta, empresa, proyecto, numero)`
- `cuenta` es implicito (se obtiene del usuario autenticado, no va en el form)
- Para UPDATE y DELETE identificar por: `empresa + proyecto + numero`
- `empresa`, `proyecto`, `fase`, `manzana`, `lote`, `cliente`, `vendedor` son readonly tras creacion: no incluir en el payload del UPDATE.

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getEmpresas()           -> prop 'empresas'            -> alimenta el Select de empresa
getProyectos()          -> prop 'proyectos'           -> alimenta el Select de proyecto (filtrado por empresa)
getFases()              -> prop 'fases'               -> alimenta el Select de fases (filtrado por proyecto)
getManzanas()           -> prop 'manzanas'            -> alimenta el Select de manzanas (filtrado por fases)
getLote()               -> prop 'lotes'               -> alimenta el Select de lotes (filtrado por mazanas)
getCliente()            -> prop 'cliente'             -> alimenta el Select de clientes (filtrado por proyecto)
getVendedor()           -> prop 'vendedor'            -> alimenta el Select de vendedores (filtrado por vendedor)

> **Unidad de extension:** el campo `t_fase.medida` (ej. `m²`, `vara²`, `ft²`) es la unidad de medida
> de los lotes de esa fase. Se obtiene de `fases.find(f => f.codigo === lote.fase)?.medida`.
> Se usa como sufijo no editable junto al campo `extension` en la tabla, en ViewField y en el Input de edicion.

Cascada: empresa → proyecto → fase → manzana → lote.
- Al cambiar empresa: resetear proyecto al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0. Luego resetear fase, manzana y lote. Tambien resetear cliente dejando en blanco con valor 0 y resetear vededor al primero disponible, y si no hubiera resetear en blanco con valor 0.

Cascada: proyecto → fase → manzana → lote.
- Al cambiar proyecto: resetear fase a la primera disponible, y si no hubiera una resetear en blanco con valor 0. Luego resetear manzana a la primera disponible, y si no hubiera una resetear a blanco. Luego resetear lote al primero disponible, y si no hubiera uno resetear en blanco. Tambien resetear cliente dejando en blanco con valor 0 y resetear vendedor al primero disponible, y si no hubiera resetear en blanco con valor 0.

Cascada: fase → manzana → lote.
- Al cambiar fase: resetear manzana a la primera disponible, y si no hubiera una resetear a blanco. Luego resetear lote, y si no hubiera uno resetear a blanco.

Cascada: manzana → lote.
- Al cambiar manzana: resetear lote al primero disponible, y si no hubiera uno resetear a blanco.

```
> `getEmpresas`, `getProyectos`, `getFases`, `getManzanas`, `getLote`, `getCliente` y `getVendedor` aplican `.eq('cuenta', cuenta)` internamente — el campo `cuenta` no aparece en ningún Select ni prop visible.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `numero`, `referencia`, `vendedor`, `observacion`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

## EXPORTACION

**Nombre de archivo:** `promesas-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `numero` (label: `"Numero"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

Sticky izquierdo: `numero` (label: `"Numero"`, es el identificador visible del PK).
`STORAGE_KEY = 'promesas_cols_v1_${userId}'`

> **Regla para FKs en la tabla:** nunca mostrar el ID numerico. Resolver al nombre legible:
> `empresa` → nombre de la empresa (prop `empresas`); 
> `proyecto` → nombre del proyecto (prop `proyectos`);
> `fase` → nombre de la fase (prop `fases`);
> `cliente` → nombre del cliente (prop `clientes`);
> `vendedor` → nombre del vendedor (prop `vendedores`);

| key                         | label           | defaultVisible | render                                                |
|-----------------------------|-----------------|----------------|-------------------------------------------------------|
| empresa                     | Empresa         | false          | nombre FK (prop `empresas`)                           |
| proyecto                    | Proyecto        | true           | nombre FK (prop `proyectos`)                          |
| numero                      | Numero          | true           | valor directo                                         |
| fecha                       | Fecha           | true           | fecha DD/MM/YYYY                                      |
| fase                        | Fase            | true           | nombre FK (prop `fases`)                              |
| manzana                     | Manzana         | true           | valor directo                                         |
| lote                        | Lote            | true           | valor directo                                         |
| cliente                     | Cliente         | true           | nombre FK (prop `clientes`)                           |
| vendedor                    | Vendedor        | false          | nombre FK (prop `vendedores`)                         |

---

## MODAL_TITLES
| Modo   | Título                  |
|--------|-------------------------|
| nuevo  | Nueva Promesa           |
| editar | Editar Promesa          |
| ver    | Promesa {numero}        |

---

## TABS_MODAL

### Tab: General  (icono: MapPin)

**[IDENTIFICACION]**

| Campo    | Label    | Ancho | View      | Nuevo               | Edit                     | Default (Nuevo)     | Notas                                               |
|----------|----------|-------|-----------|---------------------|--------------------------|---------------------|-----------------------------------------------------|
| empresa  | Empresa  | full  | ViewField | Select FK [§F]; req | Select FK [§F]; disabled | primera disponible  | prop `empresas`                                     |
| proyecto | Proyecto | full  | ViewField | Select FK [§F]; req | Select FK [§F]; disabled | primero de empresa  | prop `proyectos`                                    |
| numero   | Numero   | third | ViewField | Input [§D]; req si `proyecto.promesa_correlativo = 0`; disabled con placeholder _"Asignado automáticamente"_ si `promesa_correlativo = 1` (el trigger DB asigna el correlativo) | ViewField | | solo en su fila (wrapped en grid-cols-3); inmutable tras creación |

**[GENERAL]**

| Campo      | Label      | Ancho   | View      | Nuevo                 | Edit                     | Default (Nuevo)     | Notas                                                                    |
|------------|------------|---------|-----------|---------------------|--------------------------|---------------------|--------------------------------------------------------------------------|
| referencia | Referencia | third   | ViewField | Input [§D]          | ViewField                |                     | fila: Referencia (1/3) \| spacer (1/3) \| Fecha (1/3)                    |
| (spacer)   |            | third   | —         | —                   | —                        | —                   | celda vacía `<div />`                                                    |
| fecha      | Fecha      | third   | ViewField | Input fecha [§Z]; req | ViewField              | today               | misma fila que referencia                                                 |
| cliente    | Cliente    | full    | ViewField | ClienteCombobox [§AB] | ViewField              |                     |                                                                          |
| vendedor   | Vendedor   | full    | ViewField | Select FK [§F]; req   | ViewField              | primero de proyecto | prop `vendedores`; filtrado por proyecto                                  |
| venta      | Es Venta   | full    | ViewField "Sí/No" | Checkbox [§J]; checked | Checkbox disabled  | 1 (checked)         | campo `venta` (number 0/1); inmutable tras creación                       |

**[LOTE]**

| Campo    | Label      | Ancho | View      | Nuevo                 | Edit                     | Default (Nuevo)     | Notas                                             |
|----------|------------|-------|-----------|-----------------------|--------------------------|---------------------|---------------------------------------------------|
| fase     | Fase       | half    | ViewField | Select FK [§F]; req   | ViewField                | primera de proyecto | prop `fases`; filtrado por proyecto; misma fila que manzana y lote (grid-cols-4, col-span-2) |
| manzana  | Manzana    | quarter | ViewField | Select FK [§F]; req   | ViewField                | primera de fase     | prop `manzanas`; filtrado por empresa+proyecto+fase; 1/4 del ancho |
| lote     | Lote       | quarter | ViewField | Select FK [§F]; req   | ViewField                | primera de manzana  | prop `lotes`; filtrado por empresa+proyecto+fase+manzana; 1/4 del ancho |
| —        | Extensión  | half    | ViewField | ViewField (ro)        | ViewField (ro)           | —                   | read-only; `t_lote.extension` + `t_fase.medida` como sufijo; `loteActivoVista`/`loteActivoForm` |
| —        | Precio de venta | half | ViewField | ViewField (ro)   | ViewField (ro)           | —                   | read-only; `moneda + fmtNum(valor_lote)`; auto-rellenado al seleccionar lote |

**[OTROS]**

| Campo       | Label       | Ancho | View      | Nuevo              | Edit               | Default (Nuevo) | Notas                                    |
|-------------|-------------|-------|-----------|--------------------|--------------------|-----------------|------------------------------------------|
| observacion | Observacion | full  | ViewField | textarea [§?]; rows=2 | textarea [§?]; rows=2 | ''          | font-size: var(--ui-input); resize-none |

---

**PAGINACION:** SI 50/pag

---

## REGLAS_ESPECIFICAS

1. `numero` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. El campo `numero` en el formulario de creacion se comporta segun `t_proyecto.promesa_correlativo`:
   - `promesa_correlativo = 1`: el sistema asigna el correlativo automáticamente vía trigger `fn_correlativo_promesa`; el campo se muestra **disabled** con placeholder _"Asignado automáticamente"_; no se valida ni se requiere valor del usuario.
   - `promesa_correlativo = 0`: el usuario ingresa el número manualmente; el campo es **requerido** y debe ser mayor a 0.
3. No puede existir duplicado de `numero` dentro del mismo `(cuenta, empresa, proyecto)`. Validar en backend antes del INSERT únicamente cuando `promesa_correlativo = 0` (cuando es 1 el trigger garantiza unicidad).
4. Todos los `<Input type="number">` de esta pantalla **no muestran spinner** (flechitas de incremento). El componente `Input` lo suprime globalmente con `[appearance:textfield]` cuando `type="number"`; no se necesita clase adicional por campo.

---

## VALIDACIONES_BACKEND

- Duplicado de `numero`: solo validar cuando `t_proyecto.promesa_correlativo = 0`. Si `numero` ya existe en el mismo `(cuenta, empresa, proyecto)` -> `'Ya existe una promesa con ese numero en este proyecto.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en:
   1. `cartera.t_recibo_caja` con el mismo `(cuenta, empresa, proyecto, promesa)`. Si existen -> `'No se puede eliminar esta promesa porque tiene recibos caja asociados.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## LOGIC_ESPECIFICO

- Cascadas en `f()`: ver seccion **RELACIONES** para el detalle completo de cada cascada.
- **Unidad de extension (medida):** derivar `medida` reactivamente como `fases.find(f => f.codigo === form.fase)?.medida ?? ''`. Usar en: sufijo del Input de `extension` en modo edicion/creacion, y en `ViewField` de `extension` en modo vista. No almacenar en el form — es solo presentacion.
- `openCreate()`: pre-seleccionar primera empresa y primer proyecto de esa empresa y primera fase de ese proyecto y primera manana de esa fase y primer lote de esa manzana  **Y** pre-seleccionar `vendedor` con el primer vendedor de ese proyecto.

---

## QUERIES_TABLA

No requiere RPC ni queries especiales. Orden: `.order('empresa').order('proyecto').order('numero')`.

---

## CAMBIOS_PENDIENTES

> Solo se aplica cuando `MODO = actualizar`. Describe el delta exacto a aplicar sobre los archivos ya existentes.
> Vaciar esta sección (dejar solo esta instrucción) después de aplicar los cambios y devolver `MODO` a `nuevo`.
> Una vez aplicados todos los cambios se debe actualizar este archivo de specs reflejando los cambios descritos en esta seccion.
> Ejemplo de como se deberia especificar puntualmente los cambios realizados:
> [ENTIDAD] Agregar campo `campoXX` (string) a `EstructuraForm`
> [TABS_MODAL / General / GENERAL] Agregar fila: campoXX | Lable | half | ViewField | Input |
> [COLUMNAS_TABLA] Agregar columna `campoXX`, defaultVisible=false

### Cambios a aplicar:

> _(sin cambios pendientes)_
