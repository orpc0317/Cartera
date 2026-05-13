# CRUD: Cuentas Bancarias

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Cuentas Bancarias                                            |
| MODULO         | Bancos                                                       |
| TABLA_BD       | `cartera.t_cuenta_bancaria`                                  |
| RUTA           | `/dashboard/bancos/cuentas-bancarias`                        |
| PERMISO        | `CUE_BAN` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota)_  |
| MODO           | nuevo                                                        |

---

## MODO_GUARD

> [!CAUTION]
> **Antes de generar cualquier archivo:** verificar si `src/app/dashboard/bancos/cuentas-bancarias/page.tsx` ya existe en el repositorio.
> - **Si existe** → **DETENER. Preguntar al desarrollador** si desea sobrescribir. No continuar hasta recibir confirmación explícita de que sí.
> - **Si no existe** → continuar con el procedimiento normal.
>
> Esta verificación se omite únicamente si `MODO = actualizar`.

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
  empresa:  number
  proyecto: number
  banco:    number
  nombre:   string
  numero:   string
  moneda:   string              -- ver SKIP_KEYS
  activo:   smallint
}
```

**LLAVE_PRIMARIA compuesta:** `(cuenta, empresa, proyecto, codigo)`
- `cuenta` es implicito (se obtiene del usuario autenticado, no va en el form)
- Para UPDATE y DELETE identificar por: `empresa + proyecto + codigo`
- `empresa` y `proyecto` son readonly tras creacion: no incluir en el payload del UPDATE.

**SKIP_KEYS:** `moneda` — no aplicar `toDbString()` (normalización/uppercase). El codigo ISO debe guardarse tal cual viene del Select (ej: `'GTQ'`, `'USD'`).

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getEmpresas()   -> prop 'empresas'   -> alimenta el Select de empresa
getProyectos()  -> prop 'proyectos'  -> alimenta el Select de proyecto (filtrado por empresa)
getBancos()     -> prop 'bancos'     -> alimenta el Select de banco (filtrado por empresa+proyecto)
getMonedas()    -> prop 'monedas'    -> alimenta el Select de moneda

Cascade triple: empresa → proyecto → banco.
- Al cambiar empresa: resetear proyecto al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0, resetear banco al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0.
- Al cambiar proyecto: resetear banco al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0.

```

> `getEmpresas`, `getProyectos` y `getBancos` aplican `.eq('cuenta', cuenta)` internamente — el campo `cuenta` no aparece en ningún Select ni prop visible.
> `getMonedas` **no** filtra por cuenta — es un catálogo global compartido entre todas las cuentas.

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

## EXPORTACION

**Nombre de archivo:** `cuentas-bancarias-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `codigo` (label: `"Codigo"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

Sticky izquierdo: `codigo` (label: `"Codigo"`, es el identificador visible del PK).
`STORAGE_KEY = 'cuentas_ban_cols_v1_${userId}'`

> **Regla para FKs en la tabla:** nunca mostrar el ID numerico. Resolver al nombre legible:
> `empresa` → nombre de la empresa (prop `empresas`); 
> `proyecto` → nombre del proyecto (prop `proyectos`);
> `banco` → nombre del banco (prop `bancos`); 
> `moneda` → bandera + ISO segun **Moneda display rules** de `ui-conventions.instructions.md`.

| key      | label    | defaultVisible | render                                                |
|----------|----------|----------------|-------------------------------------------------------|
| empresa  | Empresa  | false          | nombre FK (prop `empresas`)                           |
| proyecto | Proyecto | false          | nombre FK (prop `proyectos`)                          |
| banco    | Banco    | true           | nombre FK (prop `bancos`)                             |
| nombre   | Nombre   | true           | valor directo                                         |
| numero   | Numero   | true           | valor directo                                         |
| moneda   | Moneda   | true           | Moneda display [§W]                                   |
| activo   | Activo   | true           | Badge activo [§Y]                                    |

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

| Campo  | Label         | Ancho | View           | Nuevo / Edit                               | Default (Nuevo)         | Notas                    |
|--------|---------------|-------|----------------|--------------------------------------------|-----------------------|--------------------------|
| banco  | Banco         | full  | ViewField         | Select FK [§F]; req                | primer banco disponible | prop `bancos`; filtrado por empresa+proyecto |
| nombre | Nombre Cuenta | full  | ViewField         | Input [§D]; req                    | ''                      |                                              |
| numero | Numero Cuenta | half  | ViewField         | Input [§D]; req                    | ''                      |                                              |
| moneda | Moneda        | half  | Moneda display [§W] | Select moneda [§W]; req          | 'GTQ' → monedas[0]       | prop `monedas`                               |
| activo | Activo        | full  | Badge activo [§Y] | Checkbox [§I]                     | 1                       |                                              |

---

## REGLAS_ESPECIFICAS

1. `codigo` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `(banco, numero)` dentro del mismo `(cuenta, empresa, proyecto)`. Validar en backend antes del INSERT y UPDATE con `.eq('banco', ...).eq('numero', ...)`.
3. Mostrar advertencia si `bancos.length === 0` y deshabilitar el boton "Nueva Cuenta": `"Primero crea bancos antes de agregar cuentas bancarias."`
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

## LOGIC_ESPECIFICO

- Cascadas en `f()`: ver seccion **RELACIONES** para el detalle completo de cada cascada.
- `moneda` esta en `SKIP_KEYS`: no aplicar `toDbString()` en la funcion `f()`.
- `openCreate()`: pre-seleccionar primera empresa, primer proyecto de esa empresa, primer banco
  de ese proyecto **Y** pre-seleccionar `moneda` usando el algoritmo de **Currency pre-selection from country** de `ui-conventions.instructions.md`: detectar el pais por proyecto → empresa → IP (ver **Country / Geo pre-selection** en `crud-screens.instructions.md`) y convertirlo a moneda con `COUNTRY_CURRENCY_MAP` de `@/lib/constants`. Si no existe match, usar `monedas[0].codigo` como fallback.

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
