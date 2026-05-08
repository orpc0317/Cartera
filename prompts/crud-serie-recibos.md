# CRUD: Serie Recibos

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Serie Recibos                                                |
| MODULO         | Cuentas Cobrar                                               |
| TABLA_BD       | `cartera.t_serie_recibo`                                     |
| RUTA           | `/dashboard/cuentas-cobrar/series-recibos`                   |
| PERMISO        | `SER_REC` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota)_  |
| MODO           | nuevo                                                        |

---

## MODO_GUARD

> [!CAUTION]
> **Antes de generar cualquier archivo:** verificar si `src/app/dashboard/cuentas-cobrar/series-recibos/page.tsx` ya existe en el repositorio.
> - **Si existe** → **DETENER. Preguntar al desarrollador** si desea sobrescribir. No continuar hasta recibir confirmación explícita de que sí.
> - **Si no existe** → continuar con el procedimiento normal.
>
> Esta verificación se omite únicamente si `MODO = actualizar`.

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de Series de Recibos.
Cada proyecto puede tener varias series; una de ellas es la predeterminada.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_serie_recibo`. Los tipos deben coincidir con la BD.

```
SerieRecibo {
  cuenta:           varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:          number        -- FK -> cartera.t_empresa.codigo
  proyecto:         number        -- FK -> cartera.t_proyecto.codigo, filtrado por empresa
  serie:            varchar       -- parte del PK, readonly tras creacion
  serie_factura:    varchar|null  -- opcional FK -> cartera.t_serie_factura.serie, filtrado por proyecto
  dias_fecha:       smallint      -- default 0
  correlativo:      smallint      -- default 0
  formato:          smallint      -- default 0
  predeterminado:   smallint      -- 0/1
  recibo_automatico: smallint     -- 0/1
  activo:           smallint      -- 0/1
  agrego_usuario:   uuid          -- gestionado por sistema
  agrego_fecha:     timestamptz   -- gestionado por sistema
  modifico_usuario: uuid          -- gestionado por sistema
  modifico_fecha:   timestamptz   -- token de concurrencia optimista
}

SerieReciboForm {              	-- campos editables por el usuario
  empresa:        number
  proyecto:       number
  serie:          string
  serie_factura:  string | null
  dias_fecha:     number
  correlativo:    number
  formato:        number
  predeterminado: number
  recibo_automatico: number
  activo:         number
}
```

**LLAVE_PRIMARIA compuesta:** `(cuenta, empresa, proyecto, serie)`
- `cuenta` es implicito (se obtiene del usuario autenticado, no va en el form)
- Para UPDATE y DELETE identificar por: `empresa + proyecto + serie`
- `empresa`, `proyecto` y `serie` son readonly tras creacion: no incluir en el payload del UPDATE.

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getEmpresas()       -> prop 'empresas'       -> alimenta el Select de empresa
getProyectos()      -> prop 'proyectos'      -> alimenta el Select de proyecto (filtrado por empresa)
getSeriesFactura()  -> prop 'seriesFactura'  -> alimenta el Select de serie_factura (filtrado por proyecto)

Cascade triple: empresa → proyecto → serieFacturas.
- Al cambiar empresa: resetear proyecto al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0, resetear serieFacturas al primero disponible, y si no hubiera uno disponible resetear en blanco con valor null.
- Al cambiar proyecto: resetear serieFacturas al primero disponible, y si no hubiera uno disponible resetear en blanco con valor null.

```

> `getEmpresas`, `getProyectos` y `getSeriesFactura` aplican `.eq('cuenta', cuenta)` internamente — el campo `cuenta` no aparece en ningún Select ni prop visible.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `serie_factura`, `dias_fecha`, `correlativo`, `formato`, `predeterminado`, `recibo_automatico`, `activo`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

## EXPORTACION

**Nombre de archivo:** `series-recibos-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `serie` (label: `"Serie"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

Sticky izquierdo: `serie` (label: `"Serie"`, es el identificador visible del PK).
`STORAGE_KEY = 'series_recibos_cols_v2_${userId}'`

> **Regla para FKs en la tabla:** nunca mostrar el ID numerico. Resolver al nombre legible:
> `empresa` → nombre de la empresa (prop `empresas`); `proyecto` → nombre del proyecto (prop `proyectos`).
> `serie_factura` es un codigo texto — mostrar directamente.

| key               | label           | defaultVisible | render                                                |
|-------------------|-----------------|----------------|-------------------------------------------------------|
| empresa           | Empresa         | false          | nombre de la empresa (del prop `empresas`)            |
| proyecto          | Proyecto        | true           | nombre del proyecto (del prop `proyectos`)            |
| recibo_automatico | Automatico      | true           | Sí / No (1=Si, 0=No)                                 |
| correlativo       | Correlativo     | false          | valor directo                                         |
| predeterminado    | Predeterminado  | true           | Sí / No (1=Si, 0=No)                                 |
| formato           | Formato         | true           | valor directo                                         |
| serie_factura     | Serie Factura   | true           | valor directo (codigo texto)                          |
| dias_fecha        | Dias Fecha      | false          | valor directo                                         |
| activo            | Activo          | true           | `<Badge>` emerald si activo=1, muted si activo=0      |

---

## TABS_MODAL

### Tab: General  (icono: ICONO_LUCIDE de la pantalla)

**[IDENTIFICACION]**

| Campo    | Label    | Ancho | View      | Nuevo       | Edit             | Default (Nuevo)    | Notas |
|----------|----------|-------|-----------|-------------|------------------|--------------------|-------|
| empresa  | Empresa  | full  | ViewField | Select; req | Select; disabled | primera disponible |       |
| proyecto | Proyecto | full  | ViewField | Select; req | Select; disabled | primero de empresa |       |
| serie    | Serie    | full  | ViewField | Input; req  | Input; disabled  | ''                 |       |

**[CONFIGURACION]**

| Campo             | Label          | Ancho | View          | Nuevo / Edit                                | Default (Nuevo) | Notas        |
|-------------------|----------------|-------|---------------|---------------------------------------------|-----------------|--------------|
| recibo_automatico | Automatico     | third | Checkbox      | Checkbox 0/1                                | 0               |              |
| correlativo       | Correlativo    | third | ViewField     | Input number ≥ 0; vacío si automatico=1     | 0               | ver REGLA #9 |
| formato           | Formato        | third | ViewField     | Input number ≥ 0                            | 0               | ver REGLA #4 |
| dias_fecha        | Dias Fecha     | half  | ViewField     | Input number ≥ 0                            | 0               |              |
| serie_factura     | Serie Factura  | half  | ViewField     | Select nullable; filtrado empresa+proyecto  | null            | ver REGLA #3 |
| predeterminado    | Predeterminado | half  | Checkbox      | Checkbox 0/1                                | 0               | ver REGLA #8 |
| activo            | Activo         | half  | Checkbox      | Checkbox 0/1                                | 1               |              |

---

## REGLAS_ESPECIFICAS

1. `serie` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `serie` dentro del mismo `(cuenta, empresa, proyecto)`. Validar en backend antes del INSERT
   con `.eq('cuenta', cuenta).eq('empresa', ...).eq('proyecto', ...).eq('serie', ...)`.
3. `serie_factura` es un `<Select>` (FK de `t_serie_factura`), **no** un input de texto libre.
   - El primer elemento del Select debe ser `value="" / label " "` (espacio en blanco), que representa `null` en BD. No mostrar texto como "(Ninguna)".
   - Filtrar en cliente: `seriesFactura.filter(s => s.empresa === f.empresa && s.proyecto === f.proyecto)`.
     (El codigo de proyecto puede repetirse entre empresas distintas; ambos filtros son necesarios.)
   - Al guardar: convertir `""` a `null` antes de enviar al server action.
   - No aplica normalización `f()` ni `toUpperCase()` para este campo; agregarlo a `SKIP_KEYS` para que `f()` no lo toque.
4. `formato` es un campo numerico libre (input tipo number, minimo 0). Identifica la plantilla de
   impresion del recibo de caja: el valor `n` corresponde al template `ReciboCajaN` (ej: `2` -> `ReciboCaja2`).
   - Valor `0` significa que la serie no tiene formato de impresion definido; mostrar como `0` en tabla y
     en view mode (no como texto especial).
   - No es un Select ni tiene opciones fijas — el usuario escribe el numero directamente.
   - **No se permiten valores negativos.** Clampar en `onChange`: `Math.max(0, Number(e.target.value) || 0)`.
5. `predeterminado`, `recibo_automatico` y `activo` son checkboxes (smallint 0/1), no Selects.
6. Valores por defecto al crear: `activo = 1`, todos los demas numericos en `0`.
7. Mostrar advertencia si `proyectos.length === 0` y deshabilitar el boton "Nueva Serie".
8. **Unicidad de `predeterminado`:** dentro de un mismo `(cuenta, empresa, proyecto)` solo puede haber una serie con `predeterminado = 1`. En el backend, **antes** del INSERT/UPDATE principal, si `form.predeterminado === 1` ejecutar:
   ```ts
   await admin.schema('cartera').from('t_serie_recibo')
     .update({ predeterminado: 0 })
     .eq('cuenta', cuenta).eq('empresa', empresa).eq('proyecto', proyecto)
     .neq('serie', serie)   // excluir el propio registro en UPDATE; en INSERT excluir por serie nueva
   ```
   Esto garantiza que al activar una serie como predeterminada, todas las demas del mismo proyecto
   queden en `0`, independientemente de quien haya hecho el cambio previo.
9. **Correlativo bloqueado por Recibo Automatico:** si `recibo_automatico === 1`, el campo `correlativo`
   debe mostrarse **en blanco e ineditable** (Input deshabilitado, value vacio) tanto en creacion como en
   edicion. Al guardar, enviar `correlativo: 0`. Si `recibo_automatico === 0`, el campo esta habilitado
   para entrada manual. En view mode y en la tabla, mostrar `correlativo` en blanco cuando su valor es `0`.
   - **No se permiten valores negativos.** Clampar en `onChange`: `Math.max(0, Number(e.target.value) || 0)`.
   - **sin-spin: true** — los correlativos pueden ser numeros muy grandes; los spin buttons son inutiles. Aplicar clase `[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`.

---

## VALIDACIONES_BACKEND

- Duplicado: `serie` ya existe en el mismo `(cuenta, empresa, proyecto)` -> `'Ya existe una serie con ese codigo en este proyecto.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en `cartera.t_recibo_caja` con el mismo `(cuenta, empresa, proyecto, serie)`. Si existen -> `'No se puede eliminar esta serie porque tiene recibos de caja asociados.'`. La verificacion usa `.select('cuenta', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## LOGIC_ESPECIFICO

- Cascadas en `f()`: ver seccion **RELACIONES** para el detalle completo de cada cascada.
- `openCreate()`: pre-seleccionar primera empresa, primer proyecto de esa empresa y primera serie_factura de ese proyecto.

---

## QUERIES_TABLA

No requiere RPC ni queries especiales. Orden: `.order('empresa').order('proyecto').order('serie')`.

---

## CAMBIOS_PENDIENTES

> Solo se aplica cuando `MODO = actualizar`. Describe el delta exacto a aplicar sobre los archivos ya existentes.
> Vaciar esta sección (dejar solo esta instrucción) después de aplicar los cambios y devolver `MODO` a `nuevo`.
> Ejemplo de como se deberia especificar puntualmente los cambios realizados:
> [ENTIDAD] Agregar campo `campoXX` (string) a `EstructuraForm`
> [TABS_MODAL / General / GENERAL] Agregar fila: campoXX | Lable | half | ViewField | Input |
> [COLUMNAS_TABLA] Agregar columna `campoXX`, defaultVisible=false

_(sin cambios pendientes)_
