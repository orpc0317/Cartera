# CRUD: Proyectos

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Proyectos                                                    |
| MODULO         | Proyectos                                                    |
| TABLA_BD       | `cartera.t_proyecto`                                         |
| RUTA           | `/dashboard/proyectos/proyectos`                             |
| PERMISO        | `PRO_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota)_  |
| MODO           | nuevo                                                        |

---

## MODO_GUARD

> [!CAUTION]
> **Antes de generar cualquier archivo:** verificar si `src/app/dashboard/proyectos/proyectos/page.tsx` ya existe en el repositorio.
> - **Si existe** → **DETENER. Preguntar al desarrollador** si desea sobrescribir. No continuar hasta recibir confirmación explícita de que sí.
> - **Si no existe** → continuar con el procedimiento normal.
>
> Esta verificación se omite únicamente si `MODO = actualizar`.

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de Proyectos.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_proyecto`. Los tipos deben coincidir con la BD.

```
Proyecto {
  cuenta:                           varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:                          number        -- FK -> cartera.t_empresa.codigo
  codigo:                           number        -- parte del PK, gestionado por la base de datos.
  nombre:                           string        -- nombre del proyecto
  direccion:                        string        -- direccion del proyecto
  direccion_pais:                   string        -- FK -> cartera.t_pais.codigo, (codigo ISO)
  direccion_departamento:           string        -- FK -> cartera.t_departamento.codigo, filtrado por pais
  direccion_municipio:              string        -- FK -> cartera.t_munipios.codigo, filtrado por pais, departamento
  codigo_postal:                    string        -- codigo postal de la direccion
  telefono1:                        string        -- 1er telefono de contacto
  telefono2:                        string        -- 2do telefono de contacto
  mora_automatica:                  smallint      -- 1 = si, 0 = no
  fijar_parametros_mora:            smallint      -- 1 = si, 0 = no
  forma_mora:                       smallint      -- 1 = si, 0 = no
  interes_mora:                     numeric       -- % de mora, debe ser mayor o igual a 0.00
  fijo_mora:                        numeric       -- valor fijo de mora, debe ser mayor o igual a0.00
  mora_enganche:                    smallint      -- 1 = si, 0 = no
  dias_gracia:                      integer       -- debe ser mayor o igual a 0
  dias_afectos:                     integer       -- debe ser mayor o igual a 0
  inicio_calculo_mora:              string        -- fecha del recibo (YYYY-MM-DD), default '1900-01-01'
  calcular_mora_antes:              smallint      -- 1 = si, 0 = no
  minimo_mora:                      numeric       -- debe ser mayor o igual a 0
  minimo_abono_capital:             numeric       -- debe ser mayor o igual a 0
  inicio_abono_capital_estricto:    string        -- fecha del recibo (YYYY-MM-DD), default '1900-01-01'
  promesa_vencida:                  smallint      -- 1 = si, 0 = no
  moneda:                           string        -- FK -> cartera.t_moneda
  logo_url:                         string        -- ubicacion del archivo logo
  agrego_usuario:                   uuid          -- gestionado por sistema
  agrego_fecha:                     timestamptz   -- gestionado por sistema
  modifico_usuario:                 uuid          -- gestionado por sistema
  modifico_fecha:                   timestamptz   -- token de concurrencia optimista
}

ProyectoForm {          	-- campos editables por el usuario
  empresa:                      number
  nombre:                       string
  direccion:                    string
  direccion_pais:               string
  direccion_departamento:       string
  direccion_municipio:          string
  codigo_postal:                string
  telefono1:                    string
  telefono2:                    string
  mora_automatica:              smallint
  fijar_parametros_mora:        smallint
  forma_mora:                   smallint
  interes_mora:                 numeric
  fijo_mora:                    numeric
  mora_enganche:                smallint
  dias_gracia:                  integer
  dias_afectos:                 integer
  inicio_calculo_mora:          string
  calcular_mora_antes:          smallint
  minimo_mora:                  numeric
  minimo_abono_capital:         numeric
  inicio_abono_capital_estricto:smallint
  promesa_vencida:              smallint
  moneda:                       string
  logo_url:                     string
}

```

**LLAVE_PRIMARIA compuesta:** `(cuenta, empresa, codigo)`
- `cuenta` es implicito (se obtiene del usuario autenticado, no va en el form)
- Para UPDATE y DELETE identificar por: `empresa + codigo`
- `empresa` es readonly tras creacion: no incluir en el payload del UPDATE.

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getEmpresas()       -> prop 'empresas'       -> alimenta el Select de empresa
getPaises()         -> prop 'paises'         -> alimenta el Select de paises (catalogo global)
getDepartamentos()  -> prop 'departamentos'  -> alimenta el Select de departamentos (filtrado por pais)
getMunicipios()     -> prop 'municipios'     -> alimenta el Select de municipios (filtrado por pais, departamento)
getMonedas()        -> prop 'monedas'        -> alimenta el Select de monedas (catalogo global)

Cascada: pais → departamento → municipio.
- Al cambiar pais: resetear departamento al primero disponible, y si no hubiera uno disponible resetear en blanco, resetear municipio al primero disponible, y si no hubiera uno disponible resetear en blanco
- Al cambiar departamento: resetear municipio al primero disponible, y si no hubiera uno disponible resetear en blanco

```
> `getEmpresas` aplican `.eq('cuenta', cuenta)` internamente — el campo `cuenta` no aparece en ningún Select ni prop visible.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `empresa`, `nombre`, `direccion`, `direccion_pais`, `direccion_departamento`, `direccion_municipio`, `codigo_postal`, `telefono1`, `telefono2`, `mora_automatica`, `fijar_parametros_mora`, `forma_mora`, `interes_mora`, `fijo_mora`, `mora_enganche`, `dias_gracia`, `dias_afectos`, `inicio_calculo_mora`, `calcular_mora_antes`, `minimo_mora`, `minimo_abono_capital`, `inicio_abono_capital_estricto`, `promesa_vencida`, `moneda`, `logo_url`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

## EXPORTACION

**Nombre de archivo:** `proyectos-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `codigo` (label: `"Codigo"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

Sticky izquierdo: `codigo` (label: `"Codigo"`, es el identificador visible del PK).
`STORAGE_KEY = 'proyectos_cols_v1_${userId}'`

> **Regla para FKs en la tabla:** nunca mostrar el ID numerico. Resolver al nombre legible:
> `empresa` → nombre de la empresa (prop `empresas`);
> `pais` → bandera + nombre del pais segun **Country flag rules** de `ui-conventions.instructions.md`;
> `departamento` → nombre del departamento (prop `departamentos`);
> `municipio` → nombre del municipio (prop `municipios`).

| key                     | label        | defaultVisible | render                                                         |
|-------------------------|--------------|----------------|----------------------------------------------------------------|
| empresa                 | Empresa      | true           | nombre de la empresa (del prop `empresas`)                     |
| nombre                  | Nombre       | true           | valor directo                                                  |
| direccion_pais          | Pais         | true           | bandera + nombre del pais (Country flag rules)                 |
| direccion_departamento  | Departamento | false          | nombre del departamento (del prop `departamentos`)             |
| direccion_municipio     | Municipio    | false          | nombre del municipio (del prop `municipios`)                   |
| telefono1               | Telefono     | false          | valor directo                                                  |

---

## TABS_MODAL

### Tab: General  (icono: MapPin)

**[IDENTIFICACION]**

| Campo   | Label   | Ancho | View      | Nuevo       | Edit                 | Default (Nuevo)    | Notas    |
|---------|---------|-------|-----------|-------------|----------------------|--------------------|----------|
| empresa | Empresa | full  | ViewField | Select; req | Select; disabled     | primera disponible |          |
| codigo  | Codigo  | third | ViewField | -           | ViewField (readonly) | — (auto-asignado)  |          |

**[GENERAL]**

| Campo         | Label         | Ancho | View                        | Nuevo / Edit                                                                               | Default (Nuevo)                | Notas |
|---------------|---------------|----|-----------------------------|---------------------------------------------------------------------------------------------|--------------------------------|-------|
| nombre        | Nombre        | full | ViewField                  | Input; req                                                                                  | ''                             |       |
| direccion     | Direccion     | full | ViewField                  | Input; req                                                                                  | ''                             |       |
| pais          | Pais          | half | ViewField (bandera+nombre) | `CountrySelect`; req; al cambiar: reset departamento/municipio, auto-set moneda via `COUNTRY_TO_CURRENCY` | empresa.pais → '' | Componente especial `CountrySelect` |
| departamento  | Departamento  | half | ViewField                  | `<select>` nativo; filtrado por `pais`; **disabled si no hay pais**; al cambiar: reset municipio | por pais | |
| municipio     | Municipio     | half | ViewField                  | `<select>` nativo; filtrado por `pais` + `departamento`; **disabled si no hay departamento**     | por depto | |
| codigo_postal | Codigo Postal | half | ViewField                  | Input                                                                                       | ''                             |       |
| telefono1     | Telefono 1    | full | ViewField                  | `PhoneField` (selector pais + numero local); req                                            | ''                             | E.164: `+{dialCode}{local}` |
| telefono2     | Telefono 2    | full | ViewField                  | `PhoneField` (selector {pais + numero local)                                                 | ''                            | Opcional |

### Tab: Parametros  (icono: SlidersHorizontal)

**[MORA]**

| Campo           | Label           | Ancho | View                          | Nuevo / Edit                                                                                                  | Default (Nuevo) | Notas |
|-----------------|-----------------|-------|-------------------------------|---------------------------------------------------------------------------------------------------------------|-----------------|-------|
| mora_automatica | Mora Automatica | full  | Checkbox (disabled)           | Checkbox 0/1; **habilita/deshabilita** todos los campos de calculo de mora abajo                              | 0               |       |
| forma_mora      | Forma Calculo   | 1/4   | ViewField: Diario/Mensual     | Select: Mensual=0, Diario=1; **disabled si `mora_automatica !== 1`**                                          | 0 (Mensual)     |       |
| tipoCalculo     | Tipo Calculo    | 1/4   | ViewField: Tasa/Valor Fijo    | Select UI-only: Tasa=0, Valor Fijo=1; **disabled si `mora_automatica !== 1`**; al cambiar a Tasa: zeroes `fijo_mora`; al cambiar a Valor Fijo: zeroes `interes_mora` | 0 (Tasa) | **Estado local, NO es campo de BD.** Init openView: `fijo_mora > 0 ? 1 : 0` |
| interes_mora    | % Mora          | 1/4   | ViewField (si tipoCalculo=0)  | Input number step=0.01; **visible solo si `tipoCalculo === 0`**; **disabled si `mora_automatica !== 1`**; req* si mora_automatica=1 y tipoCalculo=0 | 0 | Mutuamente exclusivo con `fijo_mora` |
| fijo_mora       | Monto Mora      | 1/4   | ViewField (si tipoCalculo=1)  | Input number step=0.01; **visible solo si `tipoCalculo === 1`**; **disabled si `mora_automatica !== 1`**; req* si mora_automatica=1 y tipoCalculo=1 | 0 | Mutuamente exclusivo con `interes_mora` |
| dias_gracia     | Dias Gracia     | 1/4   | ViewField                     | Input number; **disabled si `mora_automatica !== 1`**; requerido (>= 0) si mora_automatica=1 — **0 es válido** | 0 |       |

> Los 4 campos (forma_mora / tipoCalculo / interes_mora o fijo_mora / dias_gracia) se renderizan en una sola fila con `grid-cols-4`.

| dias_afectos    | Dias Afectos    | 1/3   | ViewField: Un Mes/Todos         | Select: Todos Los Dias=0, Un Mes=1; siempre habilitado                                                | 0 (Todos Los Dias)    |       |
| minimo_mora     | Mora Minima     | 1/3   | ViewField (2 decimales)         | Input text (inputMode=decimal); estado auxiliar `minMoraStr`; onBlur reformatea a 2 decimales (`es-GT`); siempre habilitado | 0.00 | `minMoraStr` sincroniza display ↔ `form.minimo_mora` |
| mora_enganche   | Mora Enganche   | 1/3   | Checkbox (disabled)             | Checkbox 0/1; siempre habilitado                                                                      | 0 |       |

**[ABONO CAPITAL]**

| Campo                | Label                | Ancho | View      | Nuevo / Edit                               | Default (Nuevo) | Notas |
|----------------------|----------------------|-------|-----------|--------------------------------------------|-----------------|-------|
| minimo_abono_capital | Minimo Abono Capital | 3/4   | ViewField | Input number step=0.01; siempre habilitado | 0               |      |

**[OTROS PARAMETROS]**

| Campo           | Label           | Ancho | View                                  | Nuevo / Edit                                                                                               | Default (Nuevo)                        | Notas |
|-----------------|-----------------|-------|---------------------------------------|------------------------------------------------------------------------------------------------------------|----------------------------------------|-------|
| moneda          | Moneda          | third  | bandera + ISO + nombre de moneda      | Select con banderas de `CURRENCIES` (lista hardcoded en cliente); req; **auto-set al cambiar pais/empresa** via `COUNTRY_TO_CURRENCY` | COUNTRY_TO_CURRENCY[empresa.pais] → 'GTQ' | No usa prop `monedas` del server; lista embebida en `_client.tsx` |
| promesa_vencida | Promesa Vencida | third  | Checkbox (disabled)                   | Checkbox 0/1; siempre habilitado                                                                           | 0                                      |       |
| logo_url        | Logo            | full  | `<img>` si existe, ViewField si no   | `LogoUploadField`; drag-and-drop o click; PNG/JPG/WebP/SVG; máx 5 MB; mín 200×200px; máx 4000×4000px (no aplica SVG) | ''                                     | Preview inmediato via `URL.createObjectURL`. Ver reglas completas en `image-upload.instructions.md`. |

---

## REGLAS_ESPECIFICAS

1. `codigo` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `nombre` dentro del mismo `(cuenta, empresa)`. Validar en backend antes del INSERT con `.eq('cuenta', cuenta).eq('empresa', ...).eq('nombre', ...)`.
3. **Validacion de similitud de nombre (frontend):** antes de llamar a `doSave()`, comparar el nombre ingresado contra todos los proyectos de la misma `(empresa)` usando `jaroWinkler(toDbString(form.nombre), toDbString(x.nombre)) >= 0.85` (importar `jaroWinkler, toDbString` de `@/lib/utils`). Si hay coincidencias, mostrar un `AlertDialog` que lista los nombres similares y pregunta al usuario si desea continuar. El boton de confirmacion dice `"Si, es diferente — Continuar"` y llama a `doSave()`. Al editar, excluir el propio registro del analisis (`x.codigo !== viewTarget.codigo`).
4. Mostrar advertencia si `empresa.length === 0` deshabilitar el boton "Nuevo Proyecto".

---

## VALIDACIONES_BACKEND

- Duplicado: `nombre` ya existe en el mismo `(cuenta, empresa)` -> `'Ya existe un proyecto con ese nombre en esta empresa.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en:
   1. `cartera.t_fase` con el mismo `(cuenta, empresa, proyecto)`. Si existen -> `'No se puede eliminar este proyecto porque tiene fases asociadas.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.
   2. `cartera.t_serie_recibo` con el mismo `(cuenta, empresa, proyecto)`. Si existen -> `'No se puede eliminar este proyecto porque tiene serie recibos asociados.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.
   3. `cartera.t_cuenta_bancaria` con el mismo `(cuenta, empresa, proyecto)`. Si existen -> `'No se puede eliminar este proyecto porque tiene cuentas bancarias asociadas.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.
   4. `cartera.t_supervisor` con el mismo `(cuenta, empresa, proyecto)`. Si existen -> `'No se puede eliminar este proyecto porque tiene supervisores asociados.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.
   5. `cartera.t_cobrador` con el mismo `(cuenta, empresa, proyecto)`. Si existen -> `'No se puede eliminar este proyecto porque tiene cobradores asociados.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.
   6. `cartera.t_cliente` con el mismo `(cuenta, empresa, proyecto)`. Si existen -> `'No se puede eliminar este proyecto porque tiene clientes asociados.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.
   7. `cartera.t_promesa` con el mismo `(cuenta, empresa, proyecto)`. Si existen -> `'No se puede eliminar este proyecto porque tiene promesas asociadas.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## LOGIC_ESPECIFICO

### Cascadas en `f()`

- **Al cambiar `empresa`:** auto-set `form.pais` = `empresa.pais`; reset `departamento`/`municipio` a `''`; auto-set `form.moneda` = `COUNTRY_TO_CURRENCY[empresa.pais] ?? 'GTQ'`; si `telefono1`/`telefono2` estan vacios, resetear `tel1Iso`/`tel2Iso` al pais de la empresa.
- **Al cambiar `pais` (via CountrySelect):** reset `departamento`/`municipio` a `''`; auto-set `form.moneda` = `COUNTRY_TO_CURRENCY[pais] ?? form.moneda`.
- **Al cambiar `departamento`:** reset `municipio` a `''`.

### Estado local `tipoCalculo` (NO va a BD)

- `0` = Tasa: muestra el campo `interes_mora`, pone `fijo_mora` en `0`.
- `1` = Valor Fijo: muestra el campo `fijo_mora`, pone `interes_mora` en `0`.
- **Inicialización en `openView()`:** `(proyecto.fijo_mora ?? 0) > 0 ? 1 : 0`.
- **Inicialización en `openCreate()`:** `0` (Tasa).

### Estado local `minMoraStr`

String formateado de `minimo_mora` con separador de miles y 2 decimales (`es-GT`). Se actualiza en `onChange` (parseFloat + setForm) y se reformatea en `onBlur` a `formatMora(form.minimo_mora)`.

### PhoneField

Cada telefono maneja dos estados locales: `{tel}Iso` (código ISO del país) y `{tel}Local` (número sin prefijo). El valor guardado en BD es E.164: `+{dialCode}{local}` si hay prefijo, o solo el numero local si no. Al abrir `openView()` se parsea el valor almacenado con `splitPhone()`. `tel1Iso` y `tel2Iso` se inicializan al pais del proyecto o, si no hay telefono guardado, al pais de la empresa.

### Campos inhabilitados por `mora_automatica`

Cuando `mora_automatica !== 1` quedan **disabled**: `forma_mora`, `tipoCalculo` (Select), `interes_mora`, `fijo_mora`, `dias_gracia`. Los campos `dias_afectos`, `minimo_mora`, `mora_enganche`, `minimo_abono_capital`, `moneda`, `promesa_vencida` y `logo_url` permanecen siempre habilitados.

### Validaciones en `handleSave()`

- Requeridos siempre: `empresa`, `nombre`, `moneda`, `direccion`, `pais`, `departamento`, `municipio`, `telefono1` (parte local).
- Si `mora_automatica === 1`: requeridos `interes_mora` (si `tipoCalculo=0`) o `fijo_mora` (si `tipoCalculo=1`), y `dias_gracia` (debe ser `>= 0`; **0 es válido** — validar con `< 0`, no con `!value`).
- Si `logoError` no esta vacio: bloquear guardado.

### Logo (`LogoUploadField`)

Soporta click o drag-and-drop. Formatos: PNG, JPG, WebP, SVG. Máx 5 MB. Para no-SVG: mín 200×200px, máx 4000×4000px. Preview inmediato via `URL.createObjectURL`. Al guardar, el archivo se sube via `uploadProjectLogo(formData, oldUrl?)` y la URL resultante reemplaza `logo_url` en el payload.

**Seguridad — ver `image-upload.instructions.md` para el patrón completo:**
- Servidor verifica magic bytes (no confiar solo en `file.type` del cliente).
- Servidor elimina el archivo anterior en Supabase Storage cuando se reemplaza un logo: pasar `viewTarget?.logo_url` como segundo argumento al action.
- Nunca usar `dangerouslySetInnerHTML` con el SVG; solo `<img src={...}>`.
- Nombre de archivo generado por el servidor (`cuenta/Date.now()-random.ext`), nunca el nombre original del usuario.

### Restriccion de eliminacion (UI — cliente)

El item "Eliminar" del dropdown **no se muestra** si existen registros en el prop `fases` con `fase.empresa === proyecto.empresa && fase.proyecto === proyecto.codigo`. Esto es validacion optimista en cliente; el backend tambien valida.

### `openCreate()`

Pre-selecciona la primera empresa disponible. Deriva `pais` y `moneda` de `empresa.pais` via `COUNTRY_TO_CURRENCY`. Inicializa `tel1Iso` y `tel2Iso` al pais de la empresa. `tipoCalculo = 0`. `minMoraStr = '0.00'`.

---

## QUERIES_TABLA

No requiere RPC ni queries especiales. Orden: `.order('empresa').order('nombre')`.

---

## CAMBIOS_PENDIENTES

> Solo se aplica cuando `MODO = actualizar`. Describe el delta exacto a aplicar sobre los archivos ya existentes.
> Vaciar esta sección (dejar solo esta instrucción) después de aplicar los cambios y devolver `MODO` a `nuevo`.
> Ejemplo de como se deberia especificar puntualmente los cambios realizados:
> [ENTIDAD] Agregar campo `campoXX` (string) a `EstructuraForm`
> [TABS_MODAL / General / GENERAL] Agregar fila: campoXX | Lable | half | ViewField | Input |
> [COLUMNAS_TABLA] Agregar columna `campoXX`, defaultVisible=false

_(sin cambios pendientes)_
