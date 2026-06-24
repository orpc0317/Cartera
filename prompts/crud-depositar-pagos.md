# SPEC: Depositar Pagos

---

## IDENTIFICACION

| Campo          | Valor                                                                                           |
|----------------|-------------------------------------------------------------------------------------------------|
| NOMBRE         | Depositar Pagos                                                                                 |
| MODULO         | Bancos → Operaciones                                                                            |
| TABLA_BD       | `cartera.t_transaccion_bancaria` (cabecera INSERT) + `cartera.t_recibo_caja` (detalle UPDATE)  |
| RUTA           | `/dashboard/bancos/operaciones/depositar-pagos`                                                 |
| PERMISO        | `DEP_BAN` — agregar en `src/lib/permisos.ts` con valor `'DEP.BAN'`                             |
| COLOR_ACENTO   | `pink-100 / pink-600`                                                                           |
| ICONO_LUCIDE   | `CircleDollarSign`                                                                              |
| PATRON_LAYOUT  | Pantalla completa — panel izquierdo (encabezado) + panel derecho (detalle). Sin lista CRUD.     |
| MODO           | nuevo                                                                                           |

---

## MODO_GUARD

> [!CAUTION]
> **Antes de generar cualquier archivo:** verificar si `src/app/dashboard/bancos/operaciones/depositar-pagos/page.tsx` ya existe en el repositorio.
> - **Si existe** → **DETENER. Preguntar al desarrollador** si desea sobrescribir. No continuar hasta recibir confirmación explícita.
> - **Si no existe** → continuar con el procedimiento normal.
>
> Esta verificación se omite únicamente si `MODO = actualizar`.

---

## DESCRIPCION

Pantalla de operación bancaria para registrar depósitos de pagos recibidos de clientes.
Aplica a recibos de caja cuya forma de pago es **Efectivo (1)** o **Cheque (2)** — es decir, formas de pago que no ingresan directamente a la cuenta bancaria y requieren ser fisicamente depositadas.

El operador selecciona la cuenta bancaria de destino, indica la fecha y número del documento del depósito, y agrega uno o más recibos de caja al detalle. Al grabar:

1. Se inserta una fila en `t_transaccion_bancaria` con el total acumulado (`estado = 1`).
2. Se actualizan todos los recibos del detalle en `t_recibo_caja` fijando `cuenta_deposito` y `transaccion_bancaria`.

Ambas operaciones deben ejecutarse de forma **atómica** (RPC); si cualquiera falla se hace rollback completo: ni queda la transacción ni quedan los recibos marcados como depositados.

Esta pantalla **no tiene lista CRUD**: no lista transacciones pasadas (eso corresponde a la futura pantalla "Transacciones Bancarias"). Solo permite crear una nueva transacción de depósito.

---

## ENTIDAD

### Cabecera — `t_transaccion_bancaria`

```
TransaccionBancaria {
  empresa:                   integer       -- FK -> t_empresa.codigo (se obtiene del encabezado)
  cuenta_bancaria:           integer       -- FK -> t_cuenta_bancaria.codigo (seleccionado en el encabezado)
  numero_transaccion:        varchar(11)   -- PK auto-generado por la BD (trigger o función), NO enviar en INSERT
  tipo_transaccion:          smallint      -- hardcoded: 1 (Deposito)
  fecha:                     date          -- ingresado por el usuario
  numero_documento:          varchar(15)   -- ingresado por el usuario (ej. boleta de depósito)
  valor:                     numeric(18,2) -- calculado: suma de monto de todos los recibos del detalle
  estado:                    smallint      -- hardcoded: 1
  origen:                    smallint      -- hardcoded: 1 (sistema)
  usuario_agrego:            uuid          -- audit, del usuario autenticado
  fecha_agrego:              timestamptz   -- audit, now()
  usuario_modifico:          uuid          -- audit, del usuario autenticado
  fecha_modifico:            timestamptz   -- audit, now()
  -- Campos no utilizados en esta operación (dejar en default 0 / NULL):
  --   partida, valor_en_letras, tipo_saldo, en_circulacion, a_nombre_de,
  --   comentario, fecha_conciliacion, tasa_cambio, cuenta_transferencia,
  --   transaccion_transferencia
}
```

### Detalle — `t_recibo_caja` (campos que se actualizan)

```
-- Solo se actualizan estos dos campos; el resto del recibo no se modifica.
t_recibo_caja {
  cuenta_deposito:      integer  -- SET = cuenta_bancaria.codigo (el código de la cuenta seleccionada en el encabezado)
  transaccion_bancaria: varchar  -- SET = numero_transaccion generado al insertar en t_transaccion_bancaria
}
-- WHERE cuenta = ? AND empresa = ? AND proyecto = ? AND serie = ? AND numero = ?
```

### Formulario de entrada (estado del componente cliente)

```
DepositarPagosForm {
  -- Encabezado
  empresa:           number    -- FK -> t_empresa.codigo
  proyecto:          number    -- FK -> t_proyecto.codigo
  cuenta_bancaria:   number    -- FK -> t_cuenta_bancaria.codigo
  fecha:             string    -- YYYY-MM-DD
  numero_documento:  string    -- max 15 caracteres

  -- Detalle (lista de recibos en estado del cliente, NO es una tabla propia)
  recibos: ReciboDetalleItem[]
}

ReciboDetalleItem {
  -- Identificadores (clave para el UPDATE)
  cuenta:        string
  empresa:       number
  proyecto:      number
  serie:         string
  numero:        number

  -- Datos de display (read-only, obtenidos al buscar el recibo)
  fecha:         string    -- fecha del recibo (DD/MM/YYYY para display)
  cliente_codigo: number
  cliente_nombre: string
  forma_pago:    number    -- 1=Efectivo, 2=Cheque
  monto:         number
  moneda:        string
}
```

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getEmpresas()          -> prop 'empresas'         -> alimenta Select de empresa
getProyectos()         -> prop 'proyectos'         -> alimenta Select de proyecto (filtrado por empresa)
getCuentasBancarias()  -> prop 'cuentasBancarias'  -> alimenta Select de cuenta bancaria (filtrado por empresa+proyecto)
getSeriesRecibo()      -> prop 'seriesRecibo'      -> alimenta Select de serie (filtrado por empresa+proyecto, activo=1)
```

Fuentes:
- `getEmpresas`         → `src/app/actions/empresas.ts`
- `getProyectos`        → `src/app/actions/proyectos.ts`
- `getCuentasBancarias` → `src/app/actions/cuentas-bancarias.ts`
- `getSeriesRecibo`     → `src/app/actions/series-recibos.ts`
- `getPermisosDetalle`  → `src/app/actions/permisos.ts`

**Cascada:**
- Al cambiar `empresa`: resetear `proyecto` al primero disponible, resetear `cuenta_bancaria` al primero disponible.
- Al cambiar `proyecto`: resetear `cuenta_bancaria` al primero disponible. Resetear también `serie` en el buscador de recibos al primero disponible de ese proyecto.
- Al cambiar `cuenta_bancaria`: no hay cascada adicional.

> `getSeriesRecibo` es para el buscador de recibos en el detalle, no para el encabezado.
> Filtrar solo series con `activo = 1` y que pertenezcan al `empresa + proyecto` del encabezado.

---

## ACCIONES

- **Crear depósito** (RPC `fn_depositar_pagos`) — requiere `puedeAgregar`
- **Buscar recibo** (`getReciboParaDeposito`) — lectura, sin permiso especial

> No hay UPDATE ni DELETE de transacciones desde esta pantalla.
> La anulación y consulta de transacciones bancarias son flujos futuros (pantalla "Transacciones Bancarias").

---

## SERVER_ACTION

### `getReciboParaDeposito`

```ts
// src/app/actions/depositar-pagos.ts
export async function getReciboParaDeposito(
  empresa: number,
  proyecto: number,
  serie: string,
  numero: number,
): Promise<{ data?: ReciboDetalleItem; error?: string }>
```

**Lógica:**
1. `getCuentaActiva()` — obtener la cuenta activa del usuario.
2. Buscar en `t_recibo_caja` WHERE `cuenta = ? AND empresa = ? AND proyecto = ? AND serie = ? AND numero = ?`.
3. Si no se encuentra → `{ error: 'Recibo no encontrado.' }`.
4. Si `forma_pago IN (3, 4)` (Deposito Cuenta / Transferencia) → `{ error: 'Este recibo no requiere depósito (forma de pago: Deposito/Transferencia).' }`.
5. Si `transaccion_bancaria IS NOT NULL` (ya depositado) → `{ error: 'Este recibo ya tiene un depósito asociado (Transaccion: XXXX).' }` — incluir el número de transacción en el mensaje.
6. Retornar `{ data: ReciboDetalleItem }` incluyendo el campo `moneda` del recibo (necesario para la validación de moneda en el cliente).
7. La validación de **moneda incompatible** y de **recibo duplicado** se realiza en el cliente, no en este server action.
8. Hacer JOIN con `t_cliente` para obtener `cliente_codigo` y `cliente_nombre`.

### `depositarPagos`

```ts
// src/app/actions/depositar-pagos.ts
export async function depositarPagos(
  form: DepositarPagosServerPayload,
): Promise<{ error?: string; numero_transaccion?: string }>

// Payload que se envía al server action:
type DepositarPagosServerPayload = {
  empresa:          number
  proyecto:         number   // parte de la PK de t_cuenta_bancaria — requerido para validación
  cuenta_bancaria:  number
  fecha:            string   // YYYY-MM-DD
  numero_documento: string
  recibos: Array<{
    cuenta:   string
    empresa:  number
    proyecto: number
    serie:    string
    numero:   number
    monto:    number
  }>
}
```

**Lógica del server action `depositarPagos`:**
1. `const guard = await requirePermiso(PERMISOS.DEP_BAN, 'agregar'); if (guard) return guard`
2. `const cuenta = await getCuentaActiva(); if (!cuenta) return { error: 'Sesión no válida.' }`
3. Validaciones previas:
   - `form.recibos.length === 0` → `{ error: 'Debe agregar al menos un recibo al depósito.' }`
   - `!form.fecha` → `{ error: 'La fecha del depósito es requerida.' }`
   - `!form.numero_documento?.trim()` → `{ error: 'El número de documento es requerido.' }`
4. Calcular `valor = form.recibos.reduce((sum, r) => sum + r.monto, 0)`.
5. Llamar al RPC `cartera.fn_depositar_pagos` con todos los parámetros.
6. Si el RPC retorna error → `{ error: rpcError.message }`.
7. Si OK → `{ numero_transaccion: resultado.numero_transaccion }`.

> **IMPORTANTE — atomicidad:**
> La inserción en `t_transaccion_bancaria` y las actualizaciones en `t_recibo_caja` **deben ejecutarse dentro de una función PostgreSQL** (`fn_depositar_pagos`) para garantizar atomicidad. No hacer el INSERT y los UPDATEs en secuencia desde el server action, ya que Supabase JS client no soporta transacciones nativas en el cliente de usuario.

### RPC `fn_depositar_pagos` (función PostgreSQL — a crear en migración)

```sql
-- Firma sugerida:
CREATE OR REPLACE FUNCTION cartera.fn_depositar_pagos(
  p_empresa          integer,
  p_proyecto         integer,   -- para validar que cuenta_bancaria pertenece al proyecto correcto
  p_cuenta_bancaria  integer,
  p_fecha            date,
  p_numero_documento varchar(15),
  p_valor            numeric(18,2),
  p_usuario          uuid,
  p_recibos          jsonb   -- array de {cuenta, empresa, proyecto, serie, numero, monto}
) RETURNS jsonb              -- { numero_transaccion: varchar(11) }
LANGUAGE plpgsql AS ...
```

La función debe:
1. **`numero_transaccion` es automático:** el trigger existente en `t_transaccion_bancaria` lo genera en el INSERT. La función no lo calcula; lo obtiene con `RETURNING numero_transaccion` después del INSERT.
2. **Validar que la cuenta bancaria corresponde al proyecto:** `SELECT moneda FROM t_cuenta_bancaria WHERE empresa = p_empresa AND proyecto = p_proyecto AND codigo = p_cuenta_bancaria`. Si no existe → RAISE EXCEPTION.
3. **Validación multi-sesión (primera escritura gana):** Para cada recibo en `p_recibos`, verificar con `SELECT ... FOR UPDATE` que `transaccion_bancaria IS NULL`. Si alguno ya tiene `transaccion_bancaria` → RAISE EXCEPTION `'El recibo SERIE-NUMERO ya fue depositado por otra sesión. Por favor refresca la pantalla.'`.
4. **Validación de moneda:** Para cada recibo verificar que `t_recibo_caja.moneda = moneda_cuenta`. Si difiere → RAISE EXCEPTION `'El recibo SERIE-NUMERO tiene moneda MONEDA_RECIBO distinta a la de la cuenta bancaria (MONEDA_CUENTA).'`.
5. INSERT en `t_transaccion_bancaria` con `tipo_transaccion=1, estado=1, origen=1`. Obtener `RETURNING numero_transaccion INTO v_numero_transaccion`.
6. Para cada recibo: UPDATE `t_recibo_caja` SET `cuenta_deposito = p_cuenta_bancaria, transaccion_bancaria = v_numero_transaccion` WHERE `cuenta=... AND empresa=... AND proyecto=... AND serie=... AND numero=...`.
7. Si cualquier paso falla → RAISE EXCEPTION (rollback automático).
8. RETURN `json_build_object('numero_transaccion', v_numero_transaccion)`.

---

## UI_LAYOUT

Esta pantalla **no usa Dialog/Modal ni lista CRUD**. La pantalla completa es el formulario de la transacción.

### Estructura general

```
┌──────────────────────────────────────────────────────────────────────┐
│  Page header (h1 "Depositar Pagos" + icono)                          │
├─────────────────────────────┬────────────────────────────────────────┤
│  Panel Izquierdo            │  Panel Derecho                         │
│  ─────────────────────────  │  ──────────────────────────────────    │
│  [IDENTIFICACION]           │  [DETALLE]                             │
│  Empresa                    │  Buscador: Serie + Nro + [Agregar]     │
│  Proyecto                   │  ─── datos del recibo buscado ───     │
│  Cuenta Bancaria            │  Tabla de recibos agregados            │
│                             │                                        │
│  [GENERAL]                  │                                        │
│  Fecha                      │                                        │
│  Numero Documento           │                                        │
├─────────────────────────────┴────────────────────────────────────────┤
│  Footer sticky: Total del depósito (right) | Botones (right)         │
└──────────────────────────────────────────────────────────────────────┘
```

### Clases del contenedor principal

```tsx
// Layout de dos paneles dentro del page content
<div className="flex gap-6 items-start h-full">
  {/* Panel izquierdo — formulario encabezado */}
  <div className="w-80 shrink-0 flex flex-col gap-4">
    {/* secciones IDENTIFICACION y GENERAL */}
  </div>

  {/* Separador vertical */}
  <div className="w-px self-stretch bg-border/60" />

  {/* Panel derecho — detalle de recibos */}
  <div className="flex-1 flex flex-col gap-4 min-w-0">
    {/* buscador + tabla */}
  </div>
</div>

{/* Footer sticky */}
<div className="sticky bottom-0 bg-card border-t border-border/60 px-6 py-3 flex items-center justify-between">
  <span className="text-sm text-muted-foreground">Total: <span className="font-semibold text-foreground">{fmt(totalDeposito)}</span></span>
  <div className="flex gap-2">
    <Button variant="outline" onClick={handleLimpiar} disabled={isPending}>Limpiar</Button>
    <Button onClick={handleGuardar} disabled={isPending || recibos.length === 0}>
      {isPending ? 'Guardando...' : 'Guardar Depósito'}
    </Button>
  </div>
</div>
```

---

## CAMPOS_ENCABEZADO

### [IDENTIFICACION]

| Campo           | Label           | Ancho | Token                                                                   | Default          | Notas |
|-----------------|-----------------|-------|-------------------------------------------------------------------------|------------------|-------|
| empresa         | Empresa         | full  | Select FK [§F]; req                                                     | primera disponible | prop `empresas` |
| proyecto        | Proyecto        | full  | Select FK [§F]; req; disabled si no hay empresa                         | primero de empresa | prop `proyectos`; filtrado por empresa |
| cuenta_bancaria | Cuenta Bancaria | full  | Select FK [§F]; req; disabled si no hay proyecto                        | primera disponible | prop `cuentasBancarias`; filtrado por empresa+proyecto; mostrar nombre |

### [GENERAL]

| Campo            | Label             | Ancho | Token                      | Default | Notas |
|------------------|-------------------|-------|----------------------------|---------|-------|
| fecha            | Fecha             | full  | Input fecha [§Z]; req      | hoy     | fecha del depósito bancario |
| numero_documento | Numero Documento  | full  | Input [§D]; req; max:15    | ''      | número de boleta de depósito |

---

## CAMPOS_DETALLE

### Buscador de Recibos

Fila de búsqueda ubicada en la parte superior del panel derecho. Permite al usuario ingresar serie y número para buscar un recibo y agregarlo al detalle.

| Campo       | Label    | Ancho  | Token                                               | Default           | Notas |
|-------------|----------|--------|-----------------------------------------------------|-------------------|-------|
| buscar_serie | Serie    | 1/3    | Select FK [§F]; disabled si no hay proyecto         | primera serie activa | prop `seriesRecibo`; filtrado activo=1 por empresa+proyecto |
| buscar_numero | Numero  | 1/3    | Input number [§E]; req; >0; sin-spin               | ''                | número del recibo a buscar |
| (botón)     | Agregar  | 1/3    | `<Button>` con estado de carga                     | —                 | llama `getReciboParaDeposito`; deshabilitado si no hay serie o número |

### Panel de Vista Previa del Recibo Buscado

Visible **solo cuando** se acaba de buscar un recibo exitosamente (antes de agregar). Desaparece al agregar o limpiar.
Todos los campos son **read-only** (ViewField).

| Campo          | Label          | Token     | Notas |
|----------------|----------------|-----------|-------|
| fecha          | Fecha          | ViewField | del recibo encontrado |
| cliente_codigo | Cod. Cliente   | ViewField | |
| cliente_nombre | Cliente        | ViewField | |
| forma_pago     | Forma de Pago  | ViewField | label de FORMAS_PAGO |
| monto          | Monto          | ViewField | fmt(monto) |
| moneda         | Moneda         | ViewField | código ISO |

### Tabla de Recibos Agregados

Tabla de recibos ya incluidos en el detalle del depósito. No tiene ColumnManager (no persiste en localStorage). Las columnas son fijas.

| key            | label          | render               |
|----------------|----------------|----------------------|
| serie          | Serie          | valor directo        |
| numero         | Numero         | valor directo        |
| fecha          | Fecha          | fecha DD/MM/YYYY     |
| cliente_codigo | Cod. Cliente   | valor directo        |
| cliente_nombre | Cliente        | valor directo        |
| forma_pago     | Forma de Pago  | label cat (FORMAS_PAGO) |
| monto          | Monto          | fmt(monto)           |
| (acciones)     | —              | Botón quitar (ícono `Trash2`, variante `ghost`, `text-destructive`) |

- Fila de **totales** al final: columna `Monto` suma todos los montos, resto de columnas vacío.
- Máximo recomendado: sin límite técnico, pero el UX de la tabla debe permitir scroll vertical si hay muchos recibos.

---

## REGLAS_ESPECIFICAS

### Validaciones al agregar un recibo

1. **No encontrado** → mostrar mensaje de error en el buscador (toast o inline bajo el input): `"Recibo no encontrado."`
2. **Forma de pago no válida** (forma_pago = 3 ó 4) → `"Este recibo no requiere depósito (forma de pago: Deposito/Transferencia)."`
3. **Ya depositado** (transaccion_bancaria IS NOT NULL) → `"Este recibo ya tiene un depósito asociado (Transaccion: XXXX)."` donde `XXXX` es el número de transacción existente.
4. **Moneda incompatible** → al buscar el recibo, comparar `recibo.moneda` con la moneda de la `cuenta_bancaria` seleccionada en el encabezado (disponible en el prop `cuentasBancarias`). Si difieren → `"La moneda del recibo ({MONEDA_RECIBO}) no coincide con la de la cuenta bancaria ({MONEDA_CUENTA})."`. Validar tanto en el cliente (al agregar) como en la RPC (guard definitivo).
5. **Recibo duplicado** (ya está en la lista local) → validar en el cliente antes de llamar al server action: `"Este recibo ya fue agregado al detalle."`

### Protección multi-sesión (concurrent write)

Escenario: el usuario A y el usuario B buscan y agregan el mismo recibo casi simultáneamente. Ambos ven el recibo como "no depositado" en sus pantallas. El usuario A graba primero.

- La función `fn_depositar_pagos` usa `SELECT ... FOR UPDATE` sobre cada recibo antes de actualizar, serializando el acceso.
- Si el usuario B intenta grabar después, la función detecta que el recibo ya tiene `transaccion_bancaria` (puesto por A) y lanza una excepción, causando rollback completo de la operación de B.
- El server action propaga el error al cliente de B, quien recibe un toast con el mensaje de error de la BD.
- **No se muestra confirmación previa al usuario** — la detección es silenciosa y ocurre únicamente en la RPC. La UI del cliente solo maneja las validaciones "soft" de los puntos 1–5 anteriores.

### Limpiar formulario (`handleLimpiar`)

- Resetea `recibos = []`.
- Resetea `buscar_serie` y `buscar_numero` a sus valores por defecto.
- Limpia el panel de vista previa.
- **No resetea** empresa, proyecto, cuenta_bancaria, fecha ni numero_documento (el operador puede querer hacer otro depósito a la misma cuenta).

### Al guardar exitosamente

- Mostrar toast de éxito: `"Depósito registrado. Transaccion: {numero_transaccion}"`.
- Llamar `router.refresh()`.
- Ejecutar `handleLimpiar` para dejar el formulario listo para un nuevo depósito (encabezado se mantiene).

### Estado de carga

- El botón "Agregar" muestra spinner/deshabilitado mientras se busca el recibo (`isPendingBuscar`).
- El botón "Guardar Depósito" muestra `"Guardando..."` mientras se ejecuta la mutación (`isPendingSave`).
- Ambos estados son independientes (usar dos `useTransition` o dos estados boolean).

### Quitar recibo del detalle

- Botón `Trash2` en cada fila de la tabla del detalle.
- Elimina el recibo de la lista local `recibos` por índice o por `(serie, numero)` como clave compuesta.
- No requiere confirmación (operación reversible: el usuario puede volver a agregar).

### Formato del total

- `fmt(totalDeposito)` — función `fmt` de `@/lib/utils`, 2 decimales, locale `es-GT`.
- El total en el footer se actualiza reactivamente al agregar/quitar recibos.
- No se muestra la moneda como prefijo (los recibos del mismo proyecto comparten moneda implícitamente; si en el futuro se permiten recibos de distintas monedas, se deberá replantear este campo).

---

## HARDCODED_MAPS

```ts
const FORMAS_PAGO: Record<number, string> = {
  1: 'Efectivo',
  2: 'Cheque',
  3: 'Deposito',
  4: 'Transferencia',
}

// Constantes de negocio para t_transaccion_bancaria (hardcoded en el server action):
const TIPO_TRANSACCION_DEPOSITO = 1
const ESTADO_TRANSACCION_ACTIVO = 1
const ORIGEN_SISTEMA            = 1
```

---

## SIDEBAR_REGISTRO

Agregar la entrada en `src/components/layout/app-sidebar.tsx` bajo el grupo **Bancos**, creando el subgrupo **Operaciones** si no existe:

```ts
{
  title: 'Operaciones',
  items: [
    { title: 'Depositar Pagos', url: '/dashboard/bancos/operaciones/depositar-pagos', icon: CircleDollarSign },
  ],
}
```

---

## PERMISO_REGISTRO

Agregar en `src/lib/permisos.ts`:

```ts
DEP_BAN: 'DEP.BAN',
```

---

## ARCHIVOS_A_GENERAR

| Archivo                                                                        | Descripción |
|--------------------------------------------------------------------------------|-------------|
| `src/app/dashboard/bancos/operaciones/depositar-pagos/page.tsx`                | Server Component; carga props; pasa a `_client.tsx` |
| `src/app/dashboard/bancos/operaciones/depositar-pagos/_client.tsx`             | Client Component; toda la UI de la pantalla |
| `src/app/actions/depositar-pagos.ts`                                           | Server Actions: `getReciboParaDeposito`, `depositarPagos` |
| `src/lib/types/depositar-pagos.ts`                                             | Tipos: `ReciboDetalleItem`, `DepositarPagosServerPayload` |
| _(migración SQL)_                                                              | Función `cartera.fn_depositar_pagos` + `numero_transaccion` sequence/trigger si no existe |

---

## CAMBIOS

| Fecha      | Descripción |
|------------|-------------|
| 2026-06-20 | Spec inicial creado |
| 2026-06-20 | Agregada protección multi-sesión (SELECT FOR UPDATE en RPC) y restricción de moneda igual a la de la cuenta bancaria (validación en cliente + guard definitivo en RPC) |
| 2026-06-20 | Confirmado que `numero_transaccion` es generado por trigger existente (usar RETURNING). Agregado `p_proyecto` a la firma de la RPC y a `DepositarPagosServerPayload` (parte de la PK de `t_cuenta_bancaria`). |
| 2026-06-20 | `page.tsx` usa `getEmpresasUsuario()` y `getProyectosUsuario()` (filtradas por `t_usuario_proyecto`) en lugar de `getEmpresas()`/`getProyectos()`. Los selects de empresa y proyecto solo muestran lo accesible por el usuario autenticado. |
