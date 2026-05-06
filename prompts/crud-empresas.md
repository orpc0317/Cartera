# CRUD: Empresas

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Empresas                                                     |
| MODULO         | Proyectos                                                    |
| TABLA_BD       | `cartera.t_empresa`                                          |
| RUTA           | `/dashboard/proyectos/empresa `                              |
| PERMISO        | `EMP_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | _(elegir segun modulo; ver nota)_                            |
| ICONO_LUCIDE   | _(elegir segun nombre y contexto de la pantalla; ver nota)_  |
| MODO           | nuevo                                                        |

---

## MODO_GUARD

> [!CAUTION]
> **Antes de generar cualquier archivo:** verificar si `src/app/dashboard/proyectos/empresas/page.tsx` ya existe en el repositorio.
> - **Si existe** → **DETENER. Preguntar al desarrollador** si desea sobrescribir. No continuar hasta recibir confirmación explícita de que sí.
> - **Si no existe** → continuar con el procedimiento normal.
>
> Esta verificación se omite únicamente si `MODO = actualizar`.

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de Empresas.

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_empresa`. Los tipos deben coincidir con la BD.

```
Empresa {
  cuenta:                   varchar       -- gestionado por sistema (cuenta activa del usuario)
  codigo:                   number        -- parte del PK, gestionado por la base de datos.
  nombre:                   string        -- nombre de la empresa (nombre comercial)
  razon_social:             string        -- razon social
  identificaion_tributaria: string        -- identificacion tributaria
  direccion:                string        -- direccion de la empresa
  direccion_pais:           string        -- FK -> cartera.t_pais.codigo, (codigo ISO)
  direccion_departamento:   string        -- FK -> cartera.t_departamento.codigo, filtrado por pais
  direccion_municipio:      string        -- FK -> cartera.t_munipios.codigo, filtrado por pais, departamento
  codigo_postal:            string        -- codigo postal de la direccion
  regimen_isr:              smallint      -- 0 - No Aplica, 1 - Sobre las Utilidades de Actividades Lucrativas, 2 - Opcional Simplificado Sobre Ingresos de Actividades Lucrativas (sin Resolución), 3 - Opcional Simplificado Sobre Ingresos de Actividades Lucrativas (con Resolución)
  agrego_usuario:           uuid          -- gestionado por sistema
  agrego_fecha:             timestamptz   -- gestionado por sistema
  modifico_usuario:         uuid          -- gestionado por sistema
  modifico_fecha:           timestamptz   -- token de concurrencia optimista
}

EmpresaForm {          	-- campos editables por el usuario
  nombre:                     string
  razon_social:               string
  identificacion_tributaria:  string
  direccion:                  string
  direccion_pais:             string
  direccion_departamento:     string
  direccion_municipio:        string
  codigo_postal:              string
  regimen_isr:                smallint
}

```

**LLAVE_PRIMARIA compuesta:** `(cuenta, codigo)`
- `cuenta` es implicito (se obtiene del usuario autenticado, no va en el form)
- Para UPDATE y DELETE identificar por: `codigo`

---

## RELACIONES

FK que deben cargarse en `page.tsx` y pasarse como props al client component:

```
getPaises()         -> prop 'paises'         -> alimenta el Select de paises (catalogo global)
getDepartamentos()  -> prop 'departamentos'  -> alimenta el Select de departamentos (filtrado por pais)
getMunicipios()     -> prop 'municipios'     -> alimenta el Select de municipios (filtrado por pais, departamento)

Cascada: pais → departamento → municipio.
- Al cambiar pais: resetear departamento al primero disponible, y si no hubiera uno disponible resetear en blanco, resetear municipio al primero disponible, y si no hubiera uno disponible resetear en blanco
- Al cambiar departamento: resetear municipio al primero disponible, y si no hubiera uno disponible resetear en blanco

```
---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `nombre`, `razon_social`, `identificacion_tributaria`, `direccion`, `direccion_pais`, `direccion_departamento`, `direccion_municipio`, `codigo_postal`, `regimen_isr`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

## EXPORTACION

**Nombre de archivo:** `empresas-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `codigo` (label: `"Codigo"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

Sticky izquierdo: `codigo` (label: `"Codigo"`, es el identificador visible del PK).
`STORAGE_KEY = 'empresas_cols_v1_${userId}'`

> **Regla para FKs en la tabla:** nunca mostrar el ID numerico. Resolver al nombre legible:
> `direccion_pais` → bandera + ISO del pais segun **Country flag rules** de `ui-conventions.instructions.md`;
> `direccion_departamento` → nombre del departamento (prop `departamentos`);
> `direccion_municipio` → nombre del municipio (prop `municipios`).

| key                         | label           | defaultVisible | render                                                |
|-----------------------------|-----------------|----------------|-------------------------------------------------------|
| nombre                      | Nombre          | true           | valor directo                                         |
| razon_social                | Razon Social    | true           | valor directo                                         |
| identificacion_tributaria   | ID Tributaria   | true           | valor directo                                         |
| direccion                   | Direccion       | false          | valor directo                                         |
| direccion_pais              | Pais            | false          | bandera + ISO del pais (Country flag rules)           |
| direccion_departamento      | Departamento    | false          | nombre del departamento (del prop `departamentos`)    |
| direccion_municipio         | Municipio       | false          | nombre del municipio (del prop `municipios`)          |
| codigo_postal               | Codigo Postal   | false          | valor directo                                         |
| regimen_isr                 | Regimen ISR     | false          | label de `REGIMENES_ISR` (importar de `@/lib/constants`) |

---

## TABS_MODAL

### Tab: General  (icono: MapPin)

**[IDENTIFICACION]**

| Campo    | Label    | Ancho | View      | Nuevo       | Edit             | Notas |
|----------|----------|-------|-----------|-------------|------------------|-------|
| codigo   | Codigo   | full  | ViewField | —           | —                |       |

**[GENERAL]**

| Campo                    | Label           | Ancho | View          | Nuevo / Edit                                  | Notas |
|--------------------------|-----------------|-------|---------------|-----------------------------------------------|-------|
| nombre                   | Nombre          | full  | ViewField     | Input; req                                    |       |
| razon_social             | Razon Social    | full  | ViewField     | Input; req                                    |       |
| identificacion_tributaria| ID Tributaria   | full  | ViewField     | Input; req                                    |       |
| direccion                | Direccion       | full  | ViewField     | Input; req                                    |       |
| direccion_pais           | Pais            | half  | ViewField     | Select; paisesFiltrados; req                  |       |
| direccion_departamento   | Departamento    | half  | ViewField     | Select; departamentosFiltrados pais           |       |
| direccion_municipio      | Municipio       | half  | ViewField     | Select; municipiosFiltrados pais+departamento |       |
| codigo_postal            | Codigo Postal   | half  | ViewField     | Input                                         |       |
| regimen_isr              | Regimen ISR     | full  | ViewField     | Select                                        |       |

---

## REGLAS_ESPECIFICAS

1. `codigo` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `nombre` dentro del mismo `(cuenta)`. Validar en backend antes del INSERT con `.eq('cuenta', cuenta).eq('nombre', ...)`.
3. **Validacion de similitud de nombre (frontend):** antes de llamar a `doSave()`, comparar el nombre ingresado contra todos las empresas de la misma cuenta usando `jaroWinkler(toDbString(form.nombre), toDbString(x.nombre)) >= 0.85` (importar `jaroWinkler, toDbString` de `@/lib/utils`). Si hay coincidencias, mostrar un `AlertDialog` que lista los nombres similares y pregunta al usuario si desea continuar. El boton de confirmacion dice `"Si, es diferente — Continuar"` y llama a `doSave()`. Al editar, excluir el propio registro del analisis (`x.codigo !== viewTarget.codigo`).
4. **Validacion de NIT (frontend):** si `direccion_pais === 'GT'` Y `identificacion_tributaria` no esta vacio, llamar a `validarNIT(form.identificacion_tributaria)` (importar de `@/lib/constants`). Si retorna `false` -> `toast.error('El NIT no tiene una estructura válida.')` y abortar el guardado.

---

## VALIDACIONES_BACKEND

- Duplicado: `nombre` ya existe en el mismo `(cuenta)` -> `'Ya existe una empresa con ese nombre.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
- **Restriccion de eliminacion:** antes del DELETE, verificar que no existan registros en:
   1. `cartera.t_proyecto` con el mismo `(cuenta, empresa)`. Si existen -> `'No se puede eliminar esta empresa porque tiene proyectos asociados.'` La verificacion usa `.select('*', { count: 'exact', head: true })` para no traer datos, solo el conteo.

---

## LOGIC_ESPECIFICO

- Cascadas en `f()`: ver seccion **RELACIONES** para el detalle completo de cada cascada.
- `openCreate()`: pre-seleccionar `0` en `regimen_isr`.

---

## QUERIES_TABLA

No requiere RPC ni queries especiales. Orden: `.order('nombre')`.

---

## CAMBIOS_PENDIENTES

> Solo se aplica cuando `MODO = actualizar`. Describe el delta exacto a aplicar sobre los archivos ya existentes.
> Vaciar esta sección (dejar solo esta instrucción) después de aplicar los cambios y devolver `MODO` a `nuevo`.
> Ejemplo de como se deberia especificar puntualmente los cambios realizados:
> [ENTIDAD] Agregar campo `campoXX` (string) a `EstructuraForm`
> [TABS_MODAL / General / GENERAL] Agregar fila: campoXX | Lable | half | ViewField | Input |
> [COLUMNAS_TABLA] Agregar columna `campoXX`, defaultVisible=false

_(sin cambios pendientes)_
