# CRUD: Clientes

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Clientes                                                     |
| MODULO         | Promesas                                                     |
| TABLA_BD       | `cartera.t_cliente`                                          |
| RUTA           | `/dashboard/promesas/clientes`                               |
| PERMISO        | `CLI_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota)_  |
| MODO           | nuevo                                                        |

---

## MODO_GUARD

> [!CAUTION]
> **Antes de generar cualquier archivo:** verificar si `src/app/dashboard/promesas/clientes/page.tsx` ya existe en el repositorio.
> - **Si existe** → **DETENER. Preguntar al desarrollador** si desea sobrescribir. No continuar hasta recibir confirmación explícita de que sí.
> - **Si no existe** → continuar con el procedimiento normal.
>
> Esta verificación se omite únicamente si `MODO = actualizar`.

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de Clientes.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_cliente`. Los tipos deben coincidir con la BD.

```
Cliente {
  cuenta:                   varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:                  number        -- FK -> cartera.t_empresa.codigo
  proyecto:                 number        -- FK -> cartera.t_proyecto.codigo, filtrado por empresa
  codigo:                   number        -- parte del PK, gestionado por la base de datos.
  nombre:                   string        -- nombre del cliente
  direccion:                string        -- direccion del cliente
  direccion_pais:           string        -- FK -> cartera.t_pais.codigo, (codigo ISO)
  direccion_departamento:   string        -- FK -> cartera.t_departamento.codigo, filtrado por pais
  direccion_municipio:      string        -- FK -> cartera.t_munipios.codigo, filtrado por pais, departamento
  codigo_postal:            string        -- codigo postal de la direccion
  telefono1:                string        -- 1er telefono de contacto
  telefono2:                string        -- 2do telefono de contacto
  correo:                   string        -- correo electronico del cliente
  tipo_identificacion:      smallint      -- tipo identificacion tributaria (0 No Aplica, 1 NIT, 2 DPI, 3 Extranjero)
  nombre_factura:           string        -- nombre a facturar
  identificacion_tributaria:string        -- identificacion tributaria (NIT)
  regimen_iva:              smallint      -- regimen iva (0 No Aplica, 1 General, 2 Pequeño Contribuyente, 3 Exento)
  agrego_usuario:           uuid          -- gestionado por sistema
  agrego_fecha:             timestamptz   -- gestionado por sistema
  modifico_usuario:         uuid          -- gestionado por sistema
  modifico_fecha:           timestamptz   -- token de concurrencia optimista
}

ClienteForm {          	-- campos editables por el usuario
  empresa:                    number
  proyecto:                   number
  nombre:                     string
  direccion:                  string
  direccion_pais:             string
  direccion_departamento:     string
  direccion_municipio:        string
  codigo_postal:              string
  telefono1:                  string
  telefono2:                  string
  correo:                     string
  tipo_identificacion:        smallint
  nombre_factura:             string
  identificacion_tributaria:  string
  regimen_iva:                smallint
}

```

**LLAVE_PRIMARIA compuesta:** `(cuenta, empresa, proyecto, codigo)`
- `cuenta` es implicito (se obtiene del usuario autenticado, no va en el form)
- Para UPDATE y DELETE identificar por: `empresa + proyecto + codigo`
- `empresa` y `proyecto` son readonly tras creacion: no incluir en el payload del UPDATE.

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getEmpresas()       -> prop 'empresas'       -> alimenta el Select de empresa
getProyectos()      -> prop 'proyectos'      -> alimenta el Select de proyecto (filtrado por empresa)
getPaises()         -> prop 'paises'         -> alimenta el Select de paises (catalogo global)
getDepartamentos()  -> prop 'departamentos'  -> alimenta el Select de departamentos (filtrado por pais)
getMunicipios()     -> prop 'municipios'     -> alimenta el Select de municipios (filtrado por pais, departamento)

Cascada: empresa → proyecto.
- Al cambiar empresa: resetear proyecto al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0.
Cascada: pais → departamento → municipio.
- Al cambiar pais: resetear departamento al primero disponible, y si no hubiera uno disponible resetear en blanco, resetear municipio al primero disponible, y si no hubiera uno disponible resetear en blanco
- Al cambiar departamento: resetear municipio al primero disponible, y si no hubiera uno disponible resetear en blanco

```
> `getEmpresas` y `getProyectos` aplican `.eq('cuenta', cuenta)` internamente — el campo `cuenta` no aparece en ningún Select ni prop visible.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `nombre`, `direccion`, `direccion_pais`, `direccion_departamento`, `direccion_municipio`, `codigo_postal`, `telefono1`, `telefono2`, `correo`, `tipo_identificacion`, `nombre_factura`, `identificacion_tributaria`, `regimen_iva`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

## EXPORTACION

**Nombre de archivo:** `clientes-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `codigo` (label: `"Codigo"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

Sticky izquierdo: `codigo` (label: `"Codigo"`, es el identificador visible del PK).
`STORAGE_KEY = 'clientes_cols_v1_${userId}'`

> **Regla para FKs en la tabla:** nunca mostrar el ID numerico. Resolver al nombre legible:
> `empresa` → nombre de la empresa (prop `empresas`); `proyecto` → nombre del proyecto (prop `proyectos`);
> `direccion_pais` → bandera + ISO del pais segun **Country flag rules** de `ui-conventions.instructions.md`;
> `direccion_departamento` → nombre del departamento (prop `departamentos`);
> `direccion_municipio` → nombre del municipio (prop `municipios`).

| key                         | label           | defaultVisible | render                                                |
|-----------------------------|-----------------|----------------|-------------------------------------------------------|
| empresa                     | Empresa         | false          | nombre FK (prop `empresas`)                           |
| proyecto                    | Proyecto        | true           | nombre FK (prop `proyectos`)                          |
| nombre                      | Nombre          | true           | valor directo                                         |
| direccion                   | Direccion       | false          | valor directo                                         |
| direccion_pais              | Pais            | false          | Flag+nombre                                           |
| direccion_departamento      | Departamento    | false          | nombre FK (prop `departamentos`)                      |
| direccion_municipio         | Municipio       | false          | nombre FK (prop `municipios`)                         |
| codigo_postal               | Codigo Postal   | false          | valor directo                                         |
| telefono1                   | Telefono        | true           | valor directo                                         |
| telefono2                   | Telefono2       | false          | valor directo                                         |
| correo                      | Correo          | true           | valor directo                                         |
| tipo_identificacion         | Identificacion  | false          | label cat (TIPO_IDENTIFICACION)                       |
| identificacion_tributaria   | ID Tributaria   | true           | valor directo                                         |
| nombre_factura              | Nombre Factura  | false          | valor directo                                         |
| regimen_iva                 | Regimen IVA     | false          | label cat (REGIMENES_IVA)                             |
| activo                      | Activo          | true           | Badge activo [§Y]                                    |

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

| Campo                    | Label           | Ancho | View          | Nuevo / Edit                                  | Default (Nuevo)              | Notas |
|--------------------------|-----------------|-------|---------------|-----------------------------------------------|------------------------------|-------|
| nombre                   | Nombre          | full  | ViewField     | Input [§D]; req                             | ''                                    |                                               |
| direccion                | Direccion       | full  | ViewField     | Input [§D]; req                             | ''                                    |                                               |
| direccion_pais           | Pais            | half  | ViewField     | Select geo [§X]; req                        | proyecto.pais → empresa.pais → IP geo |                                               |
| direccion_departamento   | Departamento    | half  | ViewField     | Select geo [§X]; disabled si no hay pais    | por pais                              |                                               |
| direccion_municipio      | Municipio       | half  | ViewField     | Select geo [§X]; disabled si no hay departamento | por depto                         |                                               |
| codigo_postal            | Codigo Postal   | half  | ViewField     | Input [§D]                                  | ''                                    |                                               |
| telefono1                | Telefono 1      | full  | ViewField     | PhoneField [crud-screens§PhoneField]; req    | ''                                    |                                               |
| telefono2                | Telefono 2      | full  | ViewField     | PhoneField [crud-screens§PhoneField]        | ''                                    | Opcional                                      |
| correo                   | Correo          | full  | ViewField     | Input [§D]                                  | ''                                    |                                               |

**[FACTURACION]**

| Campo                    | Label           | Ancho | View          | Nuevo / Edit                                  | Default (Nuevo) | Notas |
|--------------------------|-----------------|-------|---------------|-----------------------------------------------|-----------------|-------|
| tipo_identificacion      | Identificacion  | half  | ViewField     | Select cat [§G]                             | 0               | opciones: `TIPO_IDENTIFICACION` de `@/lib/constants` |
| identificacion_tributaria| ID Tributaria   | half  | ViewField     | Input [§D]; req si tipo_identificacion ≠ 0  | ''              |                                                     |
| nombre_factura           | Nombre Factura  | full  | ViewField     | Input [§D]; req si tipo_identificacion ≠ 0  | ''              |                                                     |
| regimen_iva              | Regimen IVA     | half  | ViewField     | Select cat [§G]                             | 0               | opciones: `REGIMENES_IVA` de `@/lib/constants`      |

---

## REGLAS_ESPECIFICAS

1. `codigo` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `nombre` dentro del mismo `(cuenta, empresa, proyecto)`. Validar en backend antes del INSERT con `.eq('cuenta', cuenta).eq('empresa', ...).eq('proyecto', ...).eq('nombre', ...)`.
3. **Validacion de similitud de nombre (frontend):** antes de llamar a `doSave()`, comparar el nombre ingresado contra todos los clientes del mismo `(empresa, proyecto)` usando `jaroWinkler(toDbString(form.nombre), toDbString(x.nombre)) >= 0.85` (importar `jaroWinkler, toDbString` de `@/lib/utils`). Si hay coincidencias, mostrar un `AlertDialog` que lista los nombres similares y pregunta al usuario si desea continuar. El boton de confirmacion dice `"Si, es diferente — Continuar"` y llama a `doSave()`. Al editar, excluir el propio registro del analisis (`x.codigo !== viewTarget.codigo`).
4. Mostrar advertencia si `proyectos.length === 0` deshabilitar el boton "Nuevo Cliente".
5. **Validacion de NIT (frontend):** si `direccion_pais === 'GT'` Y `tipo_identificacion === 1 (NIT)` Y `identificacion_tributaria` no esta vacio, llamar a `validarNIT(form.identificacion_tributaria)` (importar de `@/lib/constants`). Si retorna `false` -> `toast.error('El NIT no tiene una estructura válida.')` y abortar el guardado.
6. **Validacion de DPI (frontend):** si `direccion_pais === 'GT'` Y `tipo_identificacion === 2 (DPI)` Y `identificacion_tributaria` no esta vacio, llamar a `validarDPI(form.identificacion_tributaria)` (importar de `@/lib/constants`). Si retorna `false` -> `toast.error('El DPI debe contener exactamente 13 dígitos numéricos y tener una estructura de CUI válida.')` y abortar el guardado.

---

## VALIDACIONES_BACKEND

- Duplicado: `nombre` ya existe en el mismo `(cuenta, empresa, proyecto)` -> `'Ya existe un cliente con ese nombre en este proyecto.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en:
   1. `cartera.t_promesa` con el mismo `(cuenta, empresa, proyecto, cliente)`. Si existen -> `'No se puede eliminar este cliente porque tiene promesas asociadas.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.
   2. `cartera.t_recibo_caja` con el mismo `(cuenta, empresa, proyecto, cliente)`. Si existen -> `'No se puede eliminar este cliente porque tiene recibos asociados.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## LOGIC_ESPECIFICO

- Cascadas en `f()`: ver seccion **RELACIONES** para el detalle completo de cada cascada.
- **Campos de telefono con country code (`PhoneField`):** ver regla global **PhoneField pattern** en `crud-screens.instructions.md`.
- `openCreate()`: pre-seleccionar primera empresa y primer proyecto de esa empresa **Y** pre-seleccionar `0` en `tipo_identificacion` **Y** pre-seleccionar `0` en `regimen_iva` **Y** pre-seleccionar `direccion_pais` usando el algoritmo de **Country / Geo pre-selection in openCreate()** de `crud-screens.instructions.md` (3 niveles: proyecto → empresa → IP). Inicializar tambien `tel1Iso` y `tel2Iso` al pais detectado.

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

> _(sin cambios pendientes)_
