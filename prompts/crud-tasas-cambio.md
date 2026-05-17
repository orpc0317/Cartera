# CRUD: Tasas de Cambio

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Tasas de Cambio                                              |
| MODULO         | Bancos                                                       |
| TABLA_BD       | `cartera.t_moneda_tasa_cambio`                               |
| RUTA           | `/dashboard/bancos/tasas-cambio`                             |
| PERMISO        | `TSC_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | `teal-100 / teal-600`                                        |
| ICONO_LUCIDE   | `ArrowLeftRight`                                             |
| MODO           | nuevo                                                        |

> **Nota migración:** la tabla `cartera.t_moneda_tasa_cambio` no existe en el schema actual. Se debe crear antes de implementar la pantalla:
>
> ```sql
> CREATE TABLE IF NOT EXISTS cartera.t_moneda_tasa_cambio (
>   cuenta              varchar         NOT NULL,
>   empresa             integer         NOT NULL DEFAULT 0,
>   proyecto            integer         NOT NULL DEFAULT 0,
>   moneda              varchar         NOT NULL,
>   fecha               date            NOT NULL DEFAULT '1900-01-01',
>   tasa_cambio         numeric(18,8)   NOT NULL DEFAULT 0,
>   agrego_usuario      uuid            NOT NULL,
>   agrego_fecha        timestamptz     NOT NULL DEFAULT '1900-01-01 00:00:00+00',
>   PRIMARY KEY (cuenta, empresa, proyecto, moneda, fecha)
> );
> ```

---

## MODO_GUARD

> [!CAUTION]
> **Antes de generar cualquier archivo:** verificar si `src/app/dashboard/bancos/tasas-cambio/page.tsx` ya existe en el repositorio.
> - **Si existe** → **DETENER. Preguntar al desarrollador** si desea sobrescribir. No continuar hasta recibir confirmación explícita de que sí.
> - **Si no existe** → continuar con el procedimiento normal.
>
> Esta verificación se omite únicamente si `MODO = actualizar`.

---

## DESCRIPCION

Pantalla para registrar las tasas de cambio de las monedas por proyecto.

Cada proyecto puede operar con varias monedas (definidas en la pestaña Monedas del proyecto). Para cada moneda se registra la tasa de conversión vigente en una fecha específica. Las tasas se referencian contra la moneda predeterminada del proyecto.

---

## PATRON_NO_ESTANDAR

Esta pantalla difiere del patrón CRUD estándar en los siguientes aspectos:

1. **Tabla principal:** muestra una fila por combinación `(empresa, proyecto, moneda)` con la **última** tasa registrada (fecha y valor). No hay un `codigo` de fila — la identidad visual es el grupo. La agrupación se hace en cliente con `useMemo` sobre el prop `tasas` (ya ordenado por `fecha DESC`).

2. **Modal Ver:** en lugar de mostrar los campos de un solo registro, despliega la **lista completa de tasas históricas** para esa combinación `(empresa, proyecto, moneda)`, ordenada de la más reciente a la más antigua. Incluye botón "Eliminar" por fila (con `AlertDialog` de confirmación). No hay botón "Editar".

3. **Modal Nuevo:** formulario para ingresar una nueva tasa. Al abrirse desde el botón "+ Nueva Tasa" dentro del Modal Ver, pre-carga `empresa`, `proyecto` y `moneda` del grupo activo y posiciona el cursor en `fecha`. Al abrirse desde el botón global "Nueva Tasa" de la toolbar, el usuario selecciona los tres valores manualmente.

4. **Sin acción Editar** en ningún contexto. Los registros de tasa de cambio son inmutables tras la creación; solo se pueden agregar o eliminar.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_moneda_tasa_cambio`. Los tipos deben coincidir con la BD.

```
TasaCambio {
  cuenta:           varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:          number        -- FK -> cartera.t_empresa.codigo
  proyecto:         number        -- FK -> cartera.t_proyecto.codigo
  moneda:           string        -- FK -> cartera.t_moneda.codigo (varchar)
  fecha:            date          -- parte del PK; formato YYYY-MM-DD
  tasa_cambio:      number        -- numeric(18,8); debe ser mayor a 0
  agrego_usuario:   uuid          -- gestionado por sistema
  agrego_fecha:     timestamptz   -- gestionado por sistema
}

TasaCambioForm {                  -- campos editables en Modal Nuevo
  empresa:          number
  proyecto:         number
  moneda:           string
  fecha:            date          -- YYYY-MM-DD
  tasa_cambio:      number
}

TasaCambioGrupo {                 -- view-model para la tabla principal (no persiste en BD)
  empresa:          number
  proyecto:         number
  moneda:           string
  ultima_fecha:     date
  ultima_tasa:      number
}
```

**LLAVE_PRIMARIA compuesta:** `(cuenta, empresa, proyecto, moneda, fecha)`
- `cuenta` es implícito (se obtiene del usuario autenticado, no va en el form)
- Para DELETE identificar por: `empresa + proyecto + moneda + fecha`
- **No hay UPDATE.** Los registros son inmutables tras la creación.

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getEmpresas()          -> prop 'empresas'         -> Select de empresa en Modal Nuevo
getProyectos()         -> prop 'proyectos'        -> Select de proyecto en Modal Nuevo (filtrado por empresa)
getProyectoMonedas()   -> prop 'proyectoMonedas'  -> ProyectoMoneda[]; alimenta el Select de moneda
                                                     filtrado por (empresa, proyecto) donde activo = 1
getTasasCambio()       -> prop 'tasas'            -> TasaCambio[]; todas las filas de la cuenta,
                                                     ordenadas fecha DESC; la tabla agrupa en cliente
```

Cascade en Modal Nuevo: empresa → proyecto → moneda.
- Al cambiar empresa: resetear proyecto al primero disponible; si no hay, valor 0. Resetear moneda a `proyectos.find(p => p.codigo === nuevoProyecto)?.moneda ?? ''`.
- Al cambiar proyecto: resetear moneda a `proyectos.find(p => p.codigo === nuevoProyecto)?.moneda ?? ''`.

> `getEmpresas`, `getProyectos`, `getProyectoMonedas` aplican `.eq('cuenta', cuenta)` internamente.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver (abre Modal Ver con historial del grupo)
- **Sin Editar**
- Eliminar (DELETE, desde Modal Ver, por fila individual) — requiere `puedeEliminar`
- Listar con búsqueda de texto y filtros por columna
- **Sin exportación**

## EXPORTACION

**No hay funcionalidad de exportacion.**

---

## COLUMNAS_TABLA

La tabla principal muestra un agregado: una fila por `(empresa, proyecto, moneda)` con la última tasa registrada. No hay sticky de `codigo` (no aplica aquí).

`STORAGE_KEY = 'tasas_cambio_cols_v1_${userId}'`

> **Regla para FKs:** resolver `empresa` y `proyecto` al nombre legible vía props. `moneda` se muestra con flag (`CURRENCY_FLAG_MAP`) + código ISO usando el patrón Moneda display [§W].

| key          | label        | defaultVisible | render                                         |
|--------------|--------------|----------------|------------------------------------------------|
| empresa      | Empresa      | false          | nombre FK (prop `empresas`)                    |
| proyecto     | Proyecto     | true           | nombre FK (prop `proyectos`)                   |
| moneda       | Moneda       | true           | Moneda display [§W]: flag + código ISO         |
| ultima_fecha | Fecha        | true           | fecha formateada `dd/MM/yyyy`                  |
| ultima_tasa  | Tasa Cambio  | true           | numeric, 8 decimales                           |

---

## TABS_MODAL

### Tab: General  (icono: ArrowLeftRight)

> Este modal tiene **dos modos**: Ver (historial) y Nuevo (formulario). No existe modo Editar.

---

#### Modo Ver — Historial de tasas

El Modal Ver no muestra campos individuales. Muestra:

1. **Cabecera (solo lectura):** empresa · proyecto · moneda con flag — igual que la fila de la tabla.
2. **Tabla de historial:** todas las filas de `tasas` filtradas por `(empresa, proyecto, moneda)` del grupo activo, ordenadas por `fecha DESC`.

| Columna     | Label  | Render                                                                                       |
|-------------|--------|----------------------------------------------------------------------------------------------|
| fecha       | Fecha  | fecha formateada `dd/MM/yyyy`                                                                |
| tasa_cambio | Tasa   | numeric, 8 decimales                                                                         |
| (acciones)  |        | Botón "Eliminar" por fila (si `puedeEliminar`), con `AlertDialog` de confirmación           |

**Footer del Modal Ver:**
- Botón **"Cerrar"** siempre visible.
- Botón **"+ Nueva Tasa"** (si `puedeAgregar`): pre-carga `empresa`, `proyecto` y `moneda` del grupo activo y abre el Modal Nuevo con foco en `fecha`.

---

#### Modo Nuevo — Formulario

**[TASA DE CAMBIO]**

| Campo       | Label          | Ancho | Nuevo                        | Default (Nuevo)                               | Notas |
|-------------|----------------|-------|------------------------------|-----------------------------------------------|-------|
| empresa     | Empresa        | full  | Select FK [§F]; req          | primera disponible                            | prop `empresas` |
| proyecto    | Proyecto       | full  | Select FK [§F]; req          | primero de empresa                            | prop `proyectos`, filtrado por empresa |
| moneda      | Moneda         | third | Select moneda [§W]; req      | moneda del proyecto (`t_proyecto.moneda`)      | filtrar `proyectoMonedas` por empresa + proyecto + activo=1 |
| fecha       | Fecha          | third | Input fecha [§Z]; req        | fecha de hoy (`new Date().toISOString().slice(0, 10)`) | |
| tasa_cambio | Tasa Cambio    | third | Input number [§E]; req       | `''`                                          | mayor a 0; numeric(18,8) |

---

## REGLAS_ESPECIFICAS

1. La fecha ingresada debe ser estrictamente posterior a todas las fechas ya registradas para la misma combinación `(cuenta, empresa, proyecto, moneda)`. Validar en frontend (prop `tasas`) y en backend antes del INSERT.
2. `tasa_cambio` debe ser mayor a `0`. Validar en frontend antes de llamar a la action.
3. En el Select de moneda (Modal Nuevo), mostrar solo las monedas con `activo = 1` en `proyectoMonedas` para el `(empresa, proyecto)` seleccionado.
4. Si `proyectos.length === 0`, mostrar advertencia y deshabilitar el botón "Nueva Tasa" de la toolbar.
5. Al abrir Modal Ver desde una fila de la tabla, el contexto `(empresa, proyecto, moneda)` queda fijo para toda la sesión del modal.
6. Al hacer clic en "+ Nueva Tasa" desde el Modal Ver, pre-cargar `empresa`, `proyecto` y `moneda` del grupo activo en el Modal Nuevo y posicionar el foco en `fecha`.

---

## VALIDACIONES_BACKEND

- Fecha no posterior: existe alguna fila con `fecha >= nueva_fecha` para el mismo grupo `(cuenta, empresa, proyecto, moneda)` → `.gte('fecha', form.fecha).limit(1).maybeSingle()` → `'La fecha debe ser posterior a la última tasa registrada para esta moneda.'`
- `tasa_cambio` ≤ 0 → `'La tasa de cambio debe ser mayor a cero.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en `cartera.t_recibo_caja` con el mismo `(cuenta, empresa, proyecto, moneda)` y `fecha >= fecha_a_eliminar`. Si existen → `'No se puede eliminar esta tasa porque hay recibos de caja registrados en esa fecha o posterior.'`. Usar `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## LOGIC_ESPECIFICO

- Cascadas en Modal Nuevo: ver sección RELACIONES.
- `openCreate(preload?)`: si se pasa `preload: { empresa, proyecto, moneda }`, pre-cargar esos valores y poner foco en `fecha`; si no, pre-seleccionar primera empresa → primer proyecto → `proyectos.find(p => p.codigo === primerProyecto)?.moneda ?? ''`.
- La tabla principal se construye en el client component agrupando el prop `tasas` (array completo) por `(empresa, proyecto, moneda)` con `useMemo`, tomando el primer registro de cada grupo (que ya viene ordenado `fecha DESC` y por tanto es el más reciente):

```ts
const grupos = useMemo(() => {
  const map = new Map<string, TasaCambioGrupo>()
  for (const t of tasas) {
    const key = `${t.empresa}-${t.proyecto}-${t.moneda}`
    if (!map.has(key)) {
      map.set(key, { empresa: t.empresa, proyecto: t.proyecto, moneda: t.moneda, ultima_fecha: t.fecha, ultima_tasa: t.tasa_cambio })
    }
  }
  return Array.from(map.values())
}, [tasas])
```

---

## QUERIES_TABLA

`getTasasCambio()` obtiene todos los registros de `cartera.t_moneda_tasa_cambio` para la cuenta activa, sin paginación (volumen esperado bajo). Orden: `.order('empresa').order('proyecto').order('moneda').order('fecha', { ascending: false })`. No requiere RPC.

---

## CAMBIOS_PENDIENTES

_(sin cambios pendientes)_

