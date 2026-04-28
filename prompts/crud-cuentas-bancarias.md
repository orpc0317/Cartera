# CRUD: Cuentas Bancarias

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Cuentas Bancarias                                            |
| MODULO         | Bancos                                                       |
| TABLA_BD       | `cartera.t_cuenta_bancaria`                                  |
| RUTA           | `/dashboard/bancos/cuentas-bancarias`                        |
| PERMISO        | `CUE_BAN` — agregar en `src/lib/permisos.ts` si no existe   |
| COLOR_ACENTO   | `cyan`                                                       |
| ICONO_LUCIDE   | `CreditCard`                                                 |

> **Nota sobre estos campos:**
> - `PERMISO` y `RUTA`: no estan cubiertos por ningun archivo de instrucciones; siempre declarar.
> - `COLOR_ACENTO`: si se especifica, usarlo tal cual. Si se omite o indica "elegir", consultar
>   `ui-conventions.instructions.md` para ver los colores ya asignados por modulo y elegir un tono de Tailwind que no este en uso.
> Colores ya ocupados al momento de escribir este prompt:
>   emerald (Empresas), sky (Proyectos), violet (Fases), amber (Manzanas), rose (Lotes), indigo (Clientes), purple (Supervisores), teal (Bancos), cyan (Cuentas Bancarias / Cuentas Cobrar).
>   Siempre agregar la fila del nuevo modulo en `ui-conventions.instructions.md` al terminar (validar si ya existe).
> - `ICONO_LUCIDE`: si se omite o se indica "elegir segun contexto", la IA selecciona el icono
>   Lucide mas representativo basandose en el nombre y descripcion de la pantalla. Verificar en
>   https://lucide.dev/icons/ que el icono exista antes de aceptar la sugerencia.

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de Cuentas Bancarias.
Cada proyecto puede tener multiples cuentas bancarias, cada una asociada a un banco del mismo proyecto.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_cuenta_bancaria`. Los tipos deben coincidir con la BD.

```
Moneda {
  codigo: string   -- PK (codigo ISO 4217, ej: 'GTQ', 'USD')
}

CuentaBancaria {
  cuenta:           varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:          number        -- FK -> cartera.t_empresa.codigo
  proyecto:         number        -- FK -> cartera.t_proyecto.codigo, filtrado por empresa
  banco:            number        -- FK -> cartera.t_banco.codigo, filtrado por empresa+proyecto
  codigo:           number        -- parte del PK, gestionado por la base de datos (auto-incremento)
  nombre:           string        -- nombre descriptivo de la cuenta
  numero:           string        -- numero de cuenta bancaria
  moneda:           string        -- FK -> cartera.t_moneda.codigo (codigo ISO 4217)
  activo:           smallint      -- 1 = activa, 0 = inactiva
  agrego_usuario:   uuid          -- gestionado por sistema
  agrego_fecha:     timestamptz   -- gestionado por sistema
  modifico_usuario: uuid          -- gestionado por sistema
  modifico_fecha:   timestamptz   -- token de concurrencia optimista
}

CuentaBancariaForm {            -- campos editables por el usuario
  empresa:  number              -- readonly tras creacion (disabled en edit mode)
  proyecto: number              -- readonly tras creacion (disabled en edit mode)
  banco:    number              -- editable; obligatorio
  nombre:   string | not null
  numero:   string | not null
  moneda:   string              -- FK -> t_moneda.codigo; NO aplica toUpperCase/normalize (ver SKIP_KEYS)
  activo:   smallint            -- Checkbox 0/1
}
```

**LLAVE_PRIMARIA compuesta:** `(cuenta, empresa, proyecto, codigo)`
- `cuenta` es implicito (se obtiene del usuario autenticado, no va en el form)
- Para UPDATE y DELETE identificar por: `empresa + proyecto + codigo`

**CAMPOS_READONLY_TRAS_CREACION:** `empresa`, `proyecto`
Renderizar con `disabled={!!viewTarget}` en modo edicion. No incluir en el payload del UPDATE.

**SKIP_KEYS:** `moneda` — no aplicar `toDbString()` (normalización/uppercase). El codigo ISO debe guardarse tal cual viene del Select (ej: `'GTQ'`, `'USD'`).

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getEmpresas()   -> prop 'empresas'   -> alimenta el Select de empresa
getProyectos()  -> prop 'proyectos'  -> alimenta el Select de proyecto (filtrado por empresa)
getBancos()     -> prop 'bancos'     -> alimenta el Select de banco (filtrado por empresa+proyecto)
getMonedas()    -> prop 'monedas'    -> alimenta el Select de moneda
```

Cascade triple: empresa → proyecto → banco.
- Al cambiar empresa: resetear proyecto al primero disponible, resetear banco a 0.
- Al cambiar proyecto: resetear banco a 0.

> Nota: `getEmpresas`, `getProyectos` y `getBancos` aplican `.eq('cuenta', cuenta)` internamente.
> `getMonedas` no filtra por cuenta — es un catalogo global.
> El campo `cuenta` no aparece en ningún Select ni prop visible.

**Enriquecimiento de display para moneda:** `t_moneda` solo tiene `codigo` (varchar PK).
Ver regla global en `ui-conventions.instructions.md` → sección **Moneda display rules**.
Resumen: siempre bandera + codigo ISO (ej: 🇬🇹 GTQ). El mapa de banderas se llama `CURRENCY_FLAG_MAP`.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `banco`, `nombre`, `numero`, `moneda`, `activo`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

### Mapeo de permisos a UI

| Permiso (`t_menu_usuario`) | Efecto en UI |
|---|---|
| `agregar`    | Muestra/oculta el boton "Nueva Cuenta" en la barra de herramientas |
| `modificar`  | Muestra/oculta el boton "Editar" en el footer del modal; cambia el label del menu a "Ver / Editar" vs "Ver" |
| `eliminar`   | Muestra/oculta la opcion "Eliminar" en el dropdown de acciones de cada fila |

Obtener permisos en `page.tsx`:
```ts
const permisos = await getPermisosDetalle(PERMISOS.CUE_BAN)
// pasar como props: puedeAgregar={permisos.agregar} puedeModificar={permisos.modificar} puedeEliminar={permisos.eliminar}
```

---

## EXPORTACION

Ver regla general en `data-tables.instructions.md` → sección **CSV Export**.

**Nombre de archivo:** `cuentas-bancarias-YYYY-MM-DD.csv`

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
`STORAGE_KEY = 'cuentas_ban_cols_v1_${userId}'`

| key      | label    | defaultVisible |
|----------|----------|----------------|
| empresa  | Empresa  | false          |
| proyecto | Proyecto | false          |
| banco    | Banco    | true           |
| nombre   | Nombre   | true           |
| numero   | Numero   | true           |
| moneda   | Moneda   | true           |
| activo   | Activo   | true           |

---

## TABS_MODAL

> La primera pestana es siempre **General** y es obligatoria. Agregar pestanas adicionales
> solo si la pantalla lo requiere. Cada pestana contiene secciones; cada seccion se renderiza
> con `SectionDivider` y lista los campos en el orden en que deben aparecer.
> En view mode y edit mode se aplica el mismo mapa de secciones (los campos cambian de
> `<ViewField>` a `<Input>`/`<Select>`/`<Checkbox>` segun el modo).

```
Pestana: General  (icono: MapPin)
  [SectionDivider "IDENTIFICACION"]
    VIEW MODE:
      - empresa        (full — ViewField)
      - proyecto       (full — ViewField)
      - codigo         (full — ViewField; label: "Codigo"; valor: N con font-mono)
    NUEVO / EDIT MODE:
      - empresa        (full — Select; disabled en edit, ver CAMPOS_READONLY_TRAS_CREACION)
      - proyecto       (full — Select; disabled en edit, ver CAMPOS_READONLY_TRAS_CREACION)
      -- codigo no aparece en nuevo ni en edit --
  [SectionDivider "DATOS DE LA CUENTA"]
    - banco          (view + edit; full — ViewField en view; Select en edit; editable en edit; bancosFiltrados por empresa+proyecto del viewTarget)
    - nombre         (view + edit; full — requerido; label: "Nombre Cuenta")
    - numero         (view + edit; half — requerido; label: "Numero Cuenta")
    - moneda         (view + edit; half — Select cargado desde prop 'monedas'; aplicar regla global **Moneda display rules**; requerido)
    - activo         (view + edit; full — Checkbox 0/1; label: "Activo")
```

> **Nota moneda en view mode:** aplicar regla global **Moneda display rules** de `ui-conventions.instructions.md`
> (no usar `<ViewField>` estandar).

> **Nota activo en view mode:** renderizar como `<Checkbox checked={...} disabled />` con label
> a la derecha (no usar la card muted de otros checkboxes en esta pantalla).

---

## REGLAS_ESPECIFICAS

1. `codigo` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `(banco, numero)` dentro del mismo `(cuenta, empresa, proyecto)`.
   Validar en backend antes del INSERT y UPDATE con `.eq('banco', ...).eq('numero', ...)`.
3. Mostrar advertencia si `bancos.length === 0` y deshabilitar el boton "Nueva Cuenta":
   `"Primero crea bancos antes de agregar cuentas bancarias."`
4. El Select de banco en edit mode muestra `"Sin bancos para este proyecto"` si `bancosFiltrados.length === 0`.
5. Valores por defecto al crear: `moneda = 'GTQ'` (o el `codigo` del primer elemento de `monedas` si 'GTQ' no existe), `activo = 1`, numericos en `0`.

---

## VALIDACIONES_BACKEND

- Duplicado: `(banco, numero)` ya existe en el mismo `(cuenta, empresa, proyecto)` ->
  `'Ya existe una cuenta bancaria con ese banco y número en este proyecto.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas ->
  `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en
  `cartera.t_transaccion_bancaria` con el mismo `(empresa, cuenta_bancaria)`. Si existen ->
  `'No se puede eliminar: la cuenta tiene transacciones registradas.'`.
  La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## UI_ESPECIFICO

- Page header: `CreditCard` sobre `bg-cyan-100`, color icono `text-cyan-700`.
- Modal gradient header: `from-cyan-50/70 to-transparent`.
- Active row: `bg-cyan-50 dark:bg-cyan-950/30`.
- Sticky codigo (izquierdo, activo): `border-l-[3px] border-l-cyan-600 text-cyan-700`.
- Sticky acciones (derecho, activo): `bg-cyan-50 dark:bg-cyan-950/30`.
- Columna `moneda` en tabla: aplicar regla global **Moneda display rules** (bandera + codigo ISO).
- Columna `activo` en tabla: badge `bg-emerald-100 text-emerald-700` para Activo,
  `bg-muted text-muted-foreground` para Inactivo.

> La estructura de pestanas y secciones del modal esta definida en `TABS_MODAL`.

---

## LOGIC_ESPECIFICO

- Cascade empresa → proyecto → banco: al cambiar empresa en `f()`, resetear proyecto al primero
  disponible de esa empresa y banco a `0`. Al cambiar proyecto, resetear banco a `0`.
- `openCreate()`: pre-seleccionar primera empresa, primer proyecto de esa empresa, primer banco
  de ese proyecto.
- `moneda` esta en `SKIP_KEYS`: no aplicar `toDbString()` en la funcion `f()`.

---

## QUERIES

No requiere RPC ni queries especiales. Lectura directa:

```ts
admin.schema('cartera').from('t_cuenta_bancaria')
  .select('*').eq('cuenta', cuenta)
  .order('nombre')
```

---

## USA_ESTRICTAMENTE

- `.github/instructions/crud-screens.instructions.md`
- `.github/instructions/data-tables.instructions.md`
- `.github/instructions/server-actions.instructions.md`
- `.github/instructions/ui-conventions.instructions.md`

---

## ARCHIVOS_SALIDA

Exactamente tres archivos, en este orden:

1. `src/app/actions/cuentas-bancarias.ts`
   Funciones: `getCuentaActiva` (privada), `getAuditUser` (privada), `writeAudit` (privada),
   `getCuentasBancarias`, `createCuentaBancaria`, `updateCuentaBancaria`, `deleteCuentaBancaria`.

2. `src/app/dashboard/bancos/cuentas-bancarias/page.tsx`
   Server Component. Usar `Promise.all` con per-call `.catch()` segun patron de `server-actions.instructions.md`.

3. `src/app/dashboard/bancos/cuentas-bancarias/_client.tsx`
   Client Component completo: tabla con ColumnManager + ColumnFilter + teclado,
   Dialog CRUD (view/create/edit), AlertDialog de eliminacion, AuditLogDialog.

No se requieren archivos adicionales. Este proyecto no usa archivos de hooks separados ni tests.

---

## INSTRUCCION_FINAL

Genera los tres archivos aplicando TODAS las reglas de los archivos de instrucciones listados.
Si existe conflicto entre las reglas generales y las reglas especificas de este prompt,
prevalecen las de este prompt.
Tomar como referencia de implementacion el archivo `src/app/dashboard/cuentas-cobrar/series-recibos/_client.tsx`
— es el ejemplo mas completo y actualizado del patron del proyecto.
