# CRUD: Reservas

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Reservas                                                     |
| MODULO         | Promesas                                                     |
| TABLA_BD       | `cartera.t_reserva` (+ `cartera.t_recibo_caja` para datos del pago) |
| RUTA           | `/dashboard/promesas/reservas`                               |
| PERMISO        | `RES_OPE` — ya existe en `src/lib/permisos.ts`              |
| COLOR_ACENTO   | elegir según tabla de `ui-conventions.instructions.md`       |
| ICONO_LUCIDE   | `ClipboardList`                                              |
| MODO           | nuevo                                                        |

> **Nota sobre estos campos:**
> - `PERMISO` y `RUTA`: no estan cubiertos por ningun archivo de instrucciones; siempre declarar.
> - `COLOR_ACENTO`: si se especifica, usarlo tal cual. Si se omite o indica "elegir", leer la tabla **"Accent color per module"** en `.github/instructions/ui-conventions.instructions.md` para ver los colores ya asignados y elegir un tono de Tailwind que no este en uso. Si este modulo esta en la lista utilizar ese color. Al terminar de generar los archivos, agregar la fila del nuevo modulo a esa tabla (validar que no exista ya).
> - `ICONO_LUCIDE`: si se especifica, usarlo tal cual. Si se omite o indica "elegir segun contexto", leer la tabla **"Module icon per screen"** en `.github/instructions/ui-conventions.instructions.md`, elegir el icono Lucide mas representativo que no este ya en uso, verificar que exista en https://lucide.dev/icons/ y agregarlo a la tabla al terminar de generar los archivos. Si este modulo ya existe en la lista utilizar ese icono y no agregarlo a la tabla.
> - `MODO`: "nuevo" para que este prompt se utilice para desarrollar la pantalla desde cero. En modo "nuevo", si ya existiera una pantalla desarrollada para este prompt, antes de iniciar el desarrollos desce 0, se debe consultar e indicar al programador que ya hay una pantalla relacionada y que la IA la va a volver a desarrollar desde 0. Si el programador dice que SI, se procede, si dice que NO no se hace nada; "actualizar" para que este prompt se utilice estrictamente para hacer cambios a esta pantalla. Los camibos se deben detallar muy detenidamente en [CAMBIOS_PENDIENTES] y una vez realizados los cambios hay que regresar el `MODO`a "nuevo", que es el estado natural de este prompt. Y tambien hay que dejar nuevamente [CAMBIOS_PENDIENTES] en _(sin cambios pendientes)_

---

## DESCRIPCION

Pantalla para registrar y consultar Reservas de lotes.
Una Reserva formaliza el interes de un cliente sobre un lote disponible y genera un recibo de caja simultaneamente (todo en una sola transaccion vía RPC).
La reserva puede evolucionar a Promesa de Compra-Venta. No se edita ni se elimina directamente — las transiciones de estado se manejan por flujos separados (anulacion, conversion a promesa).

---

## ENTIDAD

Mapeo de los campos relevantes al UI. La tabla `cartera.t_reserva` se enriquece con datos de `t_recibo_caja` al momento de la consulta (ver `getReservas` en `src/app/actions/lotes.ts`).

```
ReservaRow {                          -- tipo ya definido en src/app/actions/lotes.ts
  cuenta:           varchar           -- gestionado por sistema (cuenta activa del usuario)
  empresa:          number            -- FK -> t_empresa
  proyecto:         number            -- FK -> t_proyecto
  numero:           number            -- parte del PK, gestionado por la base de datos
  fecha:            string            -- fecha del recibo (YYYY-MM-DD)
  fase:             number            -- FK -> t_fase
  manzana:          string            -- FK -> t_manzana.codigo
  lote:             string            -- FK -> t_lote.codigo
  cliente:          number            -- FK -> t_cliente
  vendedor:         number            -- FK -> t_vendedor
  recibo_serie:     string            -- FK -> t_serie_recibo.serie
  recibo_numero:    number            -- numero del recibo asociado
  moneda:           string            -- FK -> t_moneda
  forma_pago:       number            -- 1=Efectivo 2=Cheque 3=Deposito 4=Transferencia
  banco:            number            -- solo Cheque
  numero_cuenta:    string            -- solo Cheque
  numero_documento: string            -- Cheque/Deposito/Transferencia
  cuenta_deposito:  number            -- solo Deposito/Transferencia (FK -> t_cuenta_bancaria)
  cobrador:         number            -- FK -> t_cobrador
  estado:           number            -- 1=Abierta 2=Promesa 3=Devolucion 99=Anulado
  -- desde t_recibo_caja:
  monto:            number            -- debe ser mayor a 0.00
}

ReservaForm {                         -- campos del formulario de creacion
  empresa:         number
  proyecto:        number
  fase:            number
  manzana:         string
  lote:            string
  cliente:         number
  fecha:           string
  monto:           number
  serie_recibo:    string
  recibo:          string
  forma_pago:      number
  banco:           number
  numero_cuenta:   string
  cuenta_bancaria: number
  numero_documento:string
  vendedor:        number             
  cobrador:        number
}
```

**NOTA:** No existe `CodigoForm` ni UPDATE directo sobre `t_reserva` desde esta pantalla.
La creacion llama al RPC `cartera.fn_crear_reserva` — ver `createReserva` en `src/app/actions/lotes.ts`.

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getReservas()           -> prop 'reservasIniciales'   -> datos iniciales de la tabla
getLotesDisponibles()   -> prop 'lotesDisponibles'    -> lotes con estado = disponible
getManzanas()           -> prop 'manzanas'            -> para cascada fase -> manzana
getFases()              -> prop 'fases'               -> para cascada proyecto -> fase
getProyectos()          -> prop 'proyectos'           -> alimenta Select de proyecto
getEmpresas()           -> prop 'empresas'            -> alimenta Select de empresa
getClientes()           -> prop 'clientes'            -> alimenta ClienteCombobox
getBancos()             -> prop 'bancos'              -> alimenta Select de banco (forma_pago=2)
getCuentasBancarias()   -> prop 'cuentasBancarias'    -> alimenta Select cuenta (forma_pago=3/4)
getVendedores()         -> prop 'vendedores'          -> alimenta Select de vendedor
getCobradores()         -> prop 'cobradores'          -> alimenta Select de cobrador
getSeriesRecibo()       -> prop 'seriesRecibo'        -> alimenta Select de serie de recibo

TODAS desde src/app/actions/lotes.ts (excepto las marcadas):
  - getEmpresas()       src/app/actions/empresas.ts
  - getProyectos()      src/app/actions/proyectos.ts
  - getManzanas()       src/app/actions/manzanas.ts
  - getFases()          src/app/actions/fases.ts
  - getClientes()       src/app/actions/clientes.ts
  - getBancos()         src/app/actions/bancos.ts
  - getCuentasBancarias() src/app/actions/cuentas-bancarias.ts
  - getVendedores()     src/app/actions/vendedores.ts
  - getCobradores()     src/app/actions/cobradores.ts

Cascada empresa → proyecto → fase → manzana → lote:
- Al cambiar empresa: resetear proyecto (primero disponible), luego toda la cadena hacia abajo.
  Resetear tambien vendedor, cobrador, banco, cuenta_bancaria y serie_recibo al primero disponible.
- Al cambiar proyecto: resetear fase (primero con lotes disponibles), luego manzana y lote.
  Resetear vendedor, cobrador, banco, cuenta_bancaria y serie_recibo al primero disponible.
- Al cambiar fase: resetear manzana (primera con lotes disponibles) y lote (primer lote).
- Al cambiar manzana: resetear lote (primer lote disponible en esa manzana).
- Al cambiar forma_pago: resetear banco, num_cuenta, num_documento, cuenta_bancaria segun aplique.
- Al cambiar serie_recibo: limpiar el campo recibo (numero manual).

Helpers de cascada disponibles en _client.tsx actual:
  firstFaseId(lotes, fases, empresa, proyecto) -> number
  firstManzanaCodigo(lotes, manzanas, empresa, proyecto, fase) -> string
  firstLoteCodigo(lotes, empresa, proyecto, fase, manzana) -> string
  filterSeries(all, empresa, proyecto) -> SerieRecibo[]
  getDefaultSerie(series) -> string

Series de recibo: incluir solo las del proyecto activo. Solo series con activo=1.
```

---

## ACCIONES

- Crear (INSERT via RPC `fn_crear_reserva`) — requiere `puedeAgregar`
- Ver (solo lectura; no hay edicion directa de reservas)
- Listar con busqueda de texto y filtros por columna + filtros de fecha y vendedor
- Exportar a CSV

> **No hay UPDATE ni DELETE directo.** Las reservas son inmutables una vez creadas.
> La anulacion y la conversion a promesa son flujos separados (fuera del alcance de esta pantalla).

### Mapeo de permisos a UI

Ver regla general en `crud-screens.instructions.md` → seccion **Permission mapping to UI**.

```ts
const permisos = await getPermisosDetalle(PERMISOS.RES_OPE)
// pasar como props: puedeAgregar={permisos.agregar}
// puedeModificar y puedeEliminar no aplican en esta pantalla (no hay edicion ni borrado)
```

---

## EXPORTACION

Ver regla general en `data-tables.instructions.md` → seccion **CSV Export**.

**Nombre de archivo:** `reservas-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `numero` (label: `"Numero"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

> La tabla incluye un **selector de columnas** (`ColumnManager`) en la esquina superior derecha
> que permite al usuario mostrar u ocultar columnas y reordenarlas. La preferencia se persiste
> en `localStorage` con `STORAGE_KEY` (clave por usuario). `defaultVisible` define la
> visibilidad inicial la primera vez que el usuario abre la pantalla o al hacer "Restablecer".
>
> Columnas fijas (no entran en el selector):
> - **Sticky izquierdo**: `numero` (identificador de la reserva). Siempre visible.
> - **Sticky derecho**: columna de acciones (menu de 3 puntos, solo "Ver" y "Historial"). Siempre visible.
>
> Solo las columnas del selector pueden ocultarse.

Sticky izquierdo: `numero` (label: `"Numero"`).
`STORAGE_KEY = 'reservas_cols_v1_${userId}'`

> **Regla general para FKs en la tabla:** nunca mostrar el ID numerico/string. Resolver siempre al nombre
> legible usando los props disponibles. Ejemplos: `empresa` → nombre de la empresa; `proyecto` →
> nombre del proyecto; `fase` → nombre de la fase; `cliente` → nombre del cliente; `vendedor` → nombre del vendedor; 
> `banco` → nombre del banco; `cuenta_bancaria` → nombre de la cuenta; `cobrador` → nombre del cobrador.
> `lote` y `manzana` (codigo) se muestran directamente porque su valor ya es un codigo legible.
> `forma_pago` se resuelve con `FORMAS_PAGO`. `moneda` aplica Moneda display rules (bandera + ISO).

| key               | label            | defaultVisible | render                                                |
|-------------------|------------------|----------------|-------------------------------------------------------|
| empresa           | Empresa          | false          | nombre de la empresa (del prop `empresas`)            |
| proyecto          | Proyecto         | true           | nombre del proyecto (del prop `proyectos`)            |
| fase              | Fase             | true           | nombre de la fase (del prop `fases`)                  |
| manzana           | Manzana          | true           | codigo de la manzana (valor directo)                  |
| lote              | Lote             | true           | codigo del lote (valor directo)                       |
| cliente           | Cliente          | true           | nombre del cliente (del prop `clientes`)              |
| vendedor          | Vendedor         | false          | nombre del vendedor (del prop `vendedores`)           |
| fecha             | Fecha            | true           | fecha formateada (DD/MM/YYYY)                         |
| moneda            | Moneda           | true           | bandera + ISO (Moneda display rules)                  |
| monto             | Monto            | true           | `fmt(monto)` — 2 decimales, locale es-GT              |
| forma_pago        | Forma Pago       | false          | label de `FORMAS_PAGO`                                |
| banco             | Banco            | false          | nombre del banco (del prop `bancos`)                  |
| numero_cuenta     | Numero Cuenta    | false          | valor directo                                         |
| cuenta_bancaria   | Cuenta Bancaria  | false          | nombre de la cuenta (del prop `cuentasBancarias`)     |
| numero_documento  | Numero Documento | false          | valor directo                                         |
| estado            | Estado           | true           | `<Badge variant="outline">` con `RESERVA_ESTADOS`     |

---

## HARDCODED_MAPS

Definir como constantes fuera del componente:

```ts
const FORMAS_PAGO: Record<number, string> = {
  1: 'Efectivo',
  2: 'Cheque',
  3: 'Deposito',
  4: 'Transferencia',
}

const RESERVA_ESTADOS: Record<number, { label: string; cls: string }> = {
  1:  { label: 'Abierta',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  2:  { label: 'Promesa',    cls: 'bg-sky-100     text-sky-700     border-sky-200'     },
  3:  { label: 'Devolucion', cls: 'bg-amber-100   text-amber-700   border-amber-200'   },
  99: { label: 'Anulado',    cls: 'bg-red-100     text-red-700     border-red-200'     },
}
```

`estado` renderiza como `<Badge variant="outline">` usando el `cls` del mapa.
`moneda` renderiza con bandera + codigo ISO segun regla global **Moneda display rules** en `ui-conventions.instructions.md`.
`monto` renderiza como `fmt(monto)` (locale es-GT, 2 decimales) precedido por el codigo de moneda: `GTQ 1,500.00`.

---

## TABS_MODAL

El modal es de **solo lectura** (no hay modo edicion). Solo tiene las pestanas General y Pago.
El boton de footer dice unicamente **"Cerrar"**.

### Tab: General  (icono: MapPin)

**[IDENTIFICACION]**

| Campo    | Label    | Ancho | View                                     |
|----------|----------|-------|------------------------------------------|
| empresa  | Empresa  | full  | ViewField; nombre de la empresa          |
| proyecto | Proyecto | full  | ViewField; nombre del proyecto           |
| numero   | Numero   | half  | ViewField                                |
|          |          | half  | blank                                    |

**[GENERAL]**

| Campo    | Label    | Ancho | View                                     |
|----------|----------|-------|------------------------------------------|
| fecha    | Fecha    | half  | ViewField                                |
| estado   | Estado   | half  | Badge outline con RESERVA_ESTADOS        |
| fase     | Fase     | third | ViewField; nombre de la fase             |
| manzana  | Manzana  | third | ViewField;          |
| lote     | Lote     | third | ViewField                                |

**[CLIENTE]**

| Campo    | Label    | Ancho | View                                     |
|----------|----------|-------|------------------------------------------|
| cliente  | Cliente  | full  | ViewField; nombre del cliente            |
| vendedor | Vendedor | half  | ViewField; nombre del vendedor           |
| cobrador | Cobrador | half  | ViewField; nombre del cobrador           |

### Tab: Pago  (icono: Receipt)

**[RECIBO]**

| Campo          | Label        | Ancho | View                                     |
|----------------|--------------|-------|------------------------------------------|
| recibo_serie   | Serie        | half  | ViewField                                |
| recibo_numero  | Numero       | half  | ViewField                                |
| forma_pago     | Forma de Pago| half  | ViewField; FORMAS_PAGO label             |
| moneda         | Moneda       | half  | Moneda display (bandera + ISO)           |
| monto          | Monto        | half  | ViewField; fmt(monto) con moneda         |

**[FORMA PAGO]**

> Esta seccion solo se muestra si forma_pago != 1 (Efectivo)

| Campo           | Label               | Ancho | View                                     |
|-----------------|---------------------|-------|------------------------------------------|
| banco           | Banco               | full  | ViewField; nombre del banco (solo Cheque)|
| numero_cuenta   | Numero Cuenta       | half  | ViewField (solo Cheque)                  |
| cuenta_deposito | Cuenta Dep.         | full  | ViewField; nombre de la cuenta (Dep/Trans)|
| numero_documento| Numero Documento    | half  | ViewField                                |

---

## FORMULARIO_CREACION

El formulario de creacion es un `Dialog` separado del modal de vista.
Tiene dos pestanas: **General** y **Pago**.

### Tab: General  (icono: MapPin)

**[IDENTIFICACION]**

| Campo   | Label   | Ancho | Edit                                                  |
|---------|---------|-------|-------------------------------------------------------|
| empresa | Empresa | full  | Select; req                                           |
| proyecto| Proyecto| full  | Select; proyectosPorEmpresa; req                      |

**[GENERAL]**

| Campo   | Label   | Ancho | Edit                                                         |
|---------|---------|-------|--------------------------------------------------------------|
| fecha   | Fecha   | half  | Input type="date"; req; default hoy                         |
| fase    | Fase    | full  | Select; fasesConLotes (fases con lotes disponibles); req     |
| manzana | Manzana | full  | Select; manzanasConLotes; req                                |
| lote    | Lote    | full  | Select; lotesEnManzana; req. Muestra codigo + valor + moneda |

> Al seleccionar lote mostrar debajo un card informativo con: valor del lote, moneda, area (si existe).

| Campo    | Label    | Ancho | Edit                                                   |
|----------|----------|-------|--------------------------------------------------------|
| cliente  | Cliente  | full  | ClienteCombobox (busqueda por nombre); req             |
| vendedor | Vendedor | half  | Select; vendedoresPorProyecto (activo=1); req          |
| cobrador | Cobrador | half  | Select; cobradoresPorProyecto (activo=1); req          |

### Tab: Pago  (icono: Receipt)

**[RECIBO]**

| Campo        | Label         | Ancho | Edit                                                         |
|--------------|---------------|-------|--------------------------------------------------------------|
| serie_recibo | Serie Recibo  | half  | Select; seriesReciboPorProyecto; req                         |
| recibo       | Numero Recibo | half  | Input; visible y req solo si serie NO es automatica; sin-spin: true |
| moneda       | Moneda        | half  | Moneda display (bandera + ISO); req                          |
| monto        | Monto         | half  | Input type="number"; req; > 0; sin-spin: true                |

**[FORMA DE PAGO]**

| Campo           | Label               | Ancho | Edit                                                              |
|-----------------|---------------------|-------|-------------------------------------------------------------------|
| forma_pago      | Forma de Pago       | full  | Select hardcoded FORMAS_PAGO; req                                 |
| banco           | Banco               | full  | Select; bancosPorProyecto; visible y req solo si forma_pago=2     |
| numero_cuenta   | Numero Cuenta       | half  | Input; visible y req solo si forma_pago=2; sin-spin: true         |
| cuenta_bancaria | Cuenta Bancaria     | full  | Select; cuentasActivas; visible y req si forma_pago=3 o 4         |
| numero_documento| Numero Documento    | half  | Input; visible y req si forma_pago=2,3,4; sin-spin: true          |

---

## REGLAS_ESPECIFICAS

1. **Solo lectura en tabla.** No hay boton "Editar" ni "Eliminar" en el menu de acciones. Solo "Ver" y (si aplica) "Historial".
2. **Creacion via RPC.** Llamar a `createReserva(form, loteLastModified)` de `src/app/actions/lotes.ts`. No escribir INSERT directo.
3. **Control de concurrencia optimista del lote.** Al seleccionar un lote, capturar su `modifico_fecha` del prop `lotesDisponibles` y guardarlo en estado `loteLastModified`. Pasarlo al RPC. Si el RPC retorna `ok: false` con mensaje de concurrencia, mostrar `toast.error` con el mensaje y refrescar la pagina (`router.refresh()`).
4. **Recibo automatico vs manual.** Si la serie seleccionada tiene `recibo_automatico === 1`, ocultar el campo "Numero Recibo" y pasar `recibo: ''` al RPC. Si es manual, el campo es obligatorio.
5. **Monto maximo.** El monto ingresado no puede superar el `valor` del lote seleccionado (`loteSeleccionado.valor`). Validar en `handleSave` antes de llamar al RPC.
6. **Filtros adicionales en toolbar.** Ademas de la busqueda de texto y ColumnManager, la toolbar incluye:
   - Filtro de fecha: dos inputs `type="date"` (Desde / Hasta) para filtrar por `fecha` del recibo.
   - Filtro de vendedor: `<Select>` con todos los vendedores disponibles (valor 0 = todos).
7. **Clientes filtrados por proyecto.** El `ClienteCombobox` solo muestra clientes cuyo `proyecto === form.proyecto`.
8. **Series de recibo.** Incluir solo las del proyecto activo. Solo series con `activo=1`. La serie por defecto es la primera disponible del proyecto.
9. Mostrar advertencia si `lotesDisponibles.length === 0` y deshabilitar el boton "Nueva Reserva".

---

## VALIDACIONES_FRONTEND (en handleSave)

En orden:
1. empresa requerida
2. proyecto requerido
3. fase requerida
4. manzana requerida
5. lote requerido
6. vendedor requerido
7. cliente requerido
8. fecha requerida
9. monto > 0 y es numero valido
10. monto <= lote.valor
11. serie_recibo requerida
12. recibo requerido si la serie NO es automatica
13. forma_pago requerida (> 0)
14. banco requerido si forma_pago=2
15. numero_cuenta requerido si forma_pago=2
16. numero_documento requerido si forma_pago=2,3,4
17. cuenta_bancaria requerida si forma_pago=3 o 4
18. cobrador requerido

---

## UI_ESPECIFICO

> Aplicar **Accent patterns** de `ui-conventions.instructions.md` usando el color de acento del modulo.

> La estructura de pestanas del modal de vista esta definida en `TABS_MODAL`.
> La estructura del formulario de creacion esta definida en `FORMULARIO_CREACION`.

- `moneda` en tabla: bandera del pais + codigo ISO segun **Moneda display rules** de `ui-conventions.instructions.md`.
- `estado` en tabla: `<Badge variant="outline">` con las clases de `RESERVA_ESTADOS`.
- `monto` en tabla: `fmt(reserva.monto)` (2 decimales, locale es-GT). La moneda se muestra en la columna adyacente.
- El menu de acciones de cada fila solo expone: **"Ver"** (y **"Historial"** si el modulo lo requiere). No hay Editar ni Eliminar.

---

## LOGIC_ESPECIFICO

- Cascadas en `f()`: ver seccion **RELACIONES** para el detalle completo de cada cascada.
- `recibo_automatico`: derivar de `serieSeleccionada?.recibo_automatico === 1`. Si es `true`, ocultar campo "Num. Recibo" en el formulario y pasar `recibo: ''` al RPC.
- `loteLastModified`: estado local que se actualiza via `useEffect` cuando cambia `form.lote` — buscar el lote en `lotesDisponibles` y leer su `modifico_fecha`.
- `openCreate()`: pre-seleccionar primera empresa, primer proyecto, primera fase con lotes disponibles, primera manzana con lotes disponibles, primer lote, primer vendedor, primer cobrador, primera forma de pago (Efectivo), primera serie de recibo activa del proyecto.
- Filtros extras: mantener estado `fechaDesde`, `fechaHasta` (strings YYYY-MM-DD) y `vendedorFiltro` (number, 0 = todos). Limpiarlos con el boton "Limpiar filtros" global.

---

## QUERIES_TABLA

Utilizar las funciones ya existentes en `src/app/actions/lotes.ts`:
- `getReservas()` — lista reservas con estado=1 (Abiertas), enriquecidas con datos de `t_recibo_caja`.
- `getLotesDisponibles()` — lotes con estado disponible para el formulario de creacion.
- `getSeriesRecibo()` — ya esta en `lotes.ts`.

Orden de la tabla: los datos llegan ordenados por `numero DESC` desde `getReservas` (las mas recientes primero).

---

## USA_ESTRICTAMENTE

Leer todos los archivos de instrucciones listados en la sección **"Instrucciones de arquitectura específicas del proyecto"** de `.github/copilot-instructions.md`.

---

## ARCHIVOS_SALIDA

Exactamente dos archivos (las acciones ya existen en `src/app/actions/lotes.ts`):

1. `src/app/dashboard/promesas/reservas/page.tsx`
   Server Component. Usar `Promise.all` con per-call `.catch()` segun patron de `server-actions.instructions.md`.
   Las 13 llamadas ya estan definidas — ver archivo actual en el repositorio.

2. `src/app/dashboard/promesas/reservas/_client.tsx`
   Client Component completo: tabla con ColumnManager + ColumnFilter + filtros de fecha/vendedor + teclado,
   Dialog de vista (solo lectura, 2 tabs), Dialog de creacion (2 tabs), AuditLogDialog.
   Subcomponentes a incluir: `ViewField`, `SectionDivider`, `ColumnFilter`, `ColumnManager`, `ClienteCombobox`.

No se requieren archivos adicionales. No crear nuevas funciones de accion — reutilizar las de `src/app/actions/lotes.ts`.

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

- Si `MODO = nuevo`: genera los dos archivos completos aplicando TODAS las reglas de los archivos de instrucciones listados.
- Si `MODO = actualizar`: lee los archivos existentes y aplica **únicamente** los cambios listados en `CAMBIOS_PENDIENTES`, sin regenerar ni tocar nada que no esté en esa lista.

En ambos modos: si existe conflicto entre las reglas generales y las reglas específicas de este prompt, prevalecen las de este prompt.
