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
| MODAL_LAYOUT   | ancho                                              |
| MODO           | nuevo                                                        |

---

## MODO_GUARD

> [!CAUTION]
> **Antes de generar cualquier archivo:** verificar si `src/app/dashboard/promesas/reservas/page.tsx` ya existe en el repositorio.
> - **Si existe** → **DETENER. Preguntar al desarrollador** si desea sobrescribir. No continuar hasta recibir confirmación explícita de que sí.
> - **Si no existe** → continuar con el procedimiento normal.
>
> Esta verificación se omite únicamente si `MODO = actualizar`.

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
  estado:           number            -- 1=Abierta 2=Promesa 3=Devolucion 4=Desistido 99=Anulado
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

## EXPORTACION

**Nombre de archivo:** `reservas-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `numero` (label: `"Numero"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

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
| empresa           | Empresa          | false          | nombre FK (prop `empresas`)                           |
| proyecto          | Proyecto         | true           | nombre FK (prop `proyectos`)                          |
| fase              | Fase             | true           | nombre FK (prop `fases`)                              |
| manzana           | Manzana          | true           | valor directo                                         |
| lote              | Lote             | true           | valor directo                                         |
| cliente           | Cliente          | true           | nombre FK (prop `clientes`)                           |
| vendedor          | Vendedor         | false          | nombre FK (prop `vendedores`)                         |
| fecha             | Fecha            | true           | fecha DD/MM/YYYY                                      |
| moneda            | Moneda           | true           | Moneda display [§W]                                   |
| monto             | Monto            | true           | fmt(monto)                                            |
| forma_pago        | Forma Pago       | false          | label cat (FORMAS_PAGO)                               |
| banco             | Banco            | false          | nombre FK (prop `bancos`)                             |
| numero_cuenta     | Numero Cuenta    | false          | valor directo                                         |
| cuenta_bancaria   | Cuenta Bancaria  | false          | nombre FK (prop `cuentasBancarias`)                   |
| numero_documento  | Numero Documento | false          | valor directo                                         |
| estado            | Estado           | true           | Badge custom (`RESERVA_ESTADOS`)                      |

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
  4:  { label: 'Desistido',  cls: 'bg-orange-100  text-orange-700  border-orange-200'  },
  99: { label: 'Anulado',    cls: 'bg-red-100     text-red-700     border-red-200'     },
}
```

`estado` renderiza como `<Badge variant="outline">` usando el `cls` del mapa.
`moneda` renderiza con bandera + codigo ISO segun regla global **Moneda display rules** en `ui-conventions.instructions.md`.
`monto` renderiza como `fmt(monto)` (locale es-GT, 2 decimales). La moneda ya se muestra en la columna `moneda`; no se repite el prefijo en este campo.

---

## TABS_MODAL

Dos tabs: **General** (icono: `MapPin`) y **Pago** (icono: `Receipt`).

**Modo vista:** footer con solo `Cerrar`. **Modo nuevo:** footer `Cancelar` + `Guardar`. **No hay modo edicion** (reservas inmutables).

### Tab: General  (icono: MapPin)

**[IDENTIFICACION]**

| Campo    | Label    | Ancho | Ver       | Nuevo                                                   | Editar | Default (Nuevo)    | Notas |
|----------|----------|-------|-----------|---------------------------------------------------------|--------|--------------------|-------|
| empresa  | Empresa  | full  | ViewField | Select FK [§F]; req                                     | —      | primera disponible | prop `empresas` |
| proyecto | Proyecto | full  | ViewField | Select FK [§F]; req; disabled si no hay empresa         | —      | primero de empresa | prop `proyectos`; filtrado por empresa |
| numero   | Numero   | half  | ViewField | —                                                       | —      | auto BD            | |
| (spacer) |          | half  |           |                                                         |        |                    | |

**[GENERAL]** — `<SectionDivider label="General" />` (vista) / `<SectionDivider label="Generales" />` (nuevo)

> En modo **nuevo**: fila 1 es grid-cols-3 con Fecha + Moneda + Monto; luego Cliente (full); luego Vendedor (full).

| Campo    | Label    | Ancho          | Ver           | Nuevo                                                                                    | Editar | Default (Nuevo)     | Notas |
|----------|----------|----------------|---------------|------------------------------------------------------------------------------------------|--------|---------------------|-------|
| fecha    | Fecha    | third          | ViewField     | Input fecha [§Z]; req                                                                    | —      | hoy                 | vista: fila 3-col Fecha + spacer + Estado |
| (spacer) |          | third          | —             | —                                                                                        | —      | —                   | celda vacia en modo vista |
| estado   | Estado   | third          | Badge custom  | —                                                                                        | —      | —                   | RESERVA_ESTADOS; solo modo vista |
| moneda   | Moneda   | third          | —             | Select FK [§F]; req; disabled si no hay proyecto; opciones: `monedasPorProyecto`         | —      | moneda del lote     | Solo en Nuevo; prop `proyectoMonedas` filtrado activo=1; auto-selecciona al elegir lote |
| monto    | Monto    | third          | —             | Input number [§E]; req; >0; sin-spin                                                     | —      | ''                  | Solo en Nuevo; no puede exceder lote.valor |
| cliente  | Cliente  | full           | ViewField     | ClienteCombobox [§AB]; req                                                               | —      | ''                  | filtrado por proyecto |
| vendedor | Vendedor | full           | ViewField     | Select FK [§F]; req; disabled si no hay proyecto                                         | —      | primero del proyecto| prop `vendedores`; filtrado activo=1 por empresa+proyecto |

**[LOTE]**

> En modo **vista**, los tres campos se muestran en una sola fila de 3 columnas iguales (`grid-cols-3`).

| Campo   | Label   | Ancho        | Ver       | Nuevo                                                | Editar | Default (Nuevo)                    | Notas |
|---------|---------|--------------|-----------|------------------------------------------------------|--------|------------------------------------|-------|
| fase    | Fase    | third (vista)| ViewField | Select FK [§F]; req; disabled si no hay proyecto     | —      | primera fase con lotes disponibles | prop `fases`; opciones: `fasesConLotes` |
| manzana | Manzana | third (vista)| ViewField | Select cod [§H]; req; disabled si no hay fase        | —      | primera manzana con lotes          | opciones: `manzanasConLotes` |
| lote    | Lote    | third (vista)| ViewField | Select cod [§H]; req; disabled si no hay manzana     | —      | primer lote disponible             | opciones: `lotesEnManzana` |

> Al seleccionar lote: mostrar card informativo con valor + moneda + area (si existe).

### Tab: Pago  (icono: Receipt)

**[RECIBO]**

> En modo **nuevo**: Serie + Recibo en grid-cols-3 (Serie=third, Recibo=third, spacer=third). Moneda y Monto se encuentran en tab General/[GENERALES].

| Campo         | Label         | Ancho               | Ver                 | Nuevo                                            | Editar | Default (Nuevo)      | Notas |
|---------------|---------------|---------------------|---------------------|--------------------------------------------------|--------|----------------------|-------|
| recibo_serie  | Serie         | half (vista) / third (nuevo) | ViewField  | Select FK [§F]; req                              | —      | primera serie activa | prop `seriesRecibo`; filtrado activo=1 por empresa+proyecto |
| recibo_numero | Numero        | half (vista) / third (nuevo) | ViewField  | Input [§D]; req si recibo_automatico=0           | —      | ''                   | ocultar si serie es automatica |
| (spacer)      |               | third               | —                   | tercer celda vacia en grid-cols-3                | —      | —                    | solo en modo nuevo |
| moneda        | Moneda        | half                | Moneda display [§W] | — (campo en tab General)                         | —      | —                    | en Nuevo, Moneda esta en tab General/[GENERALES] |
| monto         | Monto         | half                | ViewField           | — (campo en tab General)                         | —      | —                    | en Nuevo, Monto esta en tab General/[GENERALES]; sin prefijo moneda |
| cobrador      | Cobrador      | full                | ViewField           | Select FK [§F]; req; disabled si no hay proyecto | —      | primero del proyecto | prop `cobradores`; filtrado activo=1 por empresa+proyecto |

**[FORMA PAGO]**

> En modo vista, esta seccion solo se muestra si forma_pago != 1 (Efectivo).

| Campo            | Label            | Ancho | Ver       | Nuevo                                     | Editar | Default (Nuevo) | Notas |
|------------------|------------------|-------|-----------|-------------------------------------------|--------|-----------------|-------|
| forma_pago       | Forma de Pago    | full  | ViewField | Select cat [§G]; req                      | —      | 1 (Efectivo)    | FORMAS_PAGO |
| banco            | Banco            | full  | ViewField | Select FK [§F]; req si forma_pago=2       | —      | ''              | prop `bancos`; visible solo si forma_pago=2 |
| numero_cuenta    | Numero Cuenta    | half  | ViewField | Input [§D]; req si forma_pago=2           | —      | ''              | visible solo si forma_pago=2 |
| cuenta_bancaria  | Cuenta Bancaria  | full  | ViewField | Select FK [§F]; req si forma_pago=3 o 4  | —      | ''              | prop `cuentasBancarias`; visible si forma_pago=3,4 |
| numero_documento | Numero Documento | half  | ViewField | Input [§D]; req si forma_pago≠1           | —      | ''              | visible si forma_pago=2,3,4 |

---

**PAGINACION:** SI 50/pag

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
9. moneda requerida
10. monto > 0 y es numero valido
11. monto <= lote.valor
12. serie_recibo requerida
13. recibo requerido si la serie NO es automatica
14. forma_pago requerida (> 0)
15. banco requerido si forma_pago=2
16. numero_cuenta requerido si forma_pago=2
17. numero_documento requerido si forma_pago=2,3,4
18. cuenta_bancaria requerida si forma_pago=3 o 4
19. cobrador requerido
18. cobrador requerido

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
- `getReservas()` — lista todas las reservas (todos los estados), enriquecidas con datos de `t_recibo_caja`.
- `getLotesDisponibles()` — lotes con estado disponible para el formulario de creacion.
- `getSeriesRecibo()` — ya esta en `lotes.ts`.

Orden de la tabla: los datos llegan ordenados por `numero DESC` desde `getReservas` (las mas recientes primero).

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
