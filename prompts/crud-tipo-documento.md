# CRUD: Tipos Documento

---

## IDENTIFICACION

| Campo          | Valor                                                        |
|----------------|--------------------------------------------------------------|
| NOMBRE         | Tipos Documento                                              |
| MODULO         | Generales                                                    |
| TABLA_BD       | `cartera.t_tipo_documento`                                   |
| RUTA           | `/dashboard/generales/tipos-documento`                       |
| PERMISO        | `TDO_CAT` — agregar en `src/lib/permisos.ts` si no existe    |
| COLOR_ACENTO   | `slate-100 / slate-600`                                      |
| ICONO_LUCIDE   | `IdCard`                                                     |
| MODAL_LAYOUT   | estandar                                                     |
| MODO           | nuevo                                                        |

---

## MODO_GUARD

> [!CAUTION]
> **Antes de generar cualquier archivo:** verificar si `src/app/dashboard/generales/tipos-documento/page.tsx` ya existe en el repositorio.
> - **Si existe** → **DETENER. Preguntar al desarrollador** si desea sobrescribir. No continuar hasta recibir confirmación explícita de que sí.
> - **Si no existe** → continuar con el procedimiento normal.
>
> Esta verificación se omite únicamente si `MODO = actualizar`.

---

## DESCRIPCION

Pantalla para dar mantenimiento al catalogo de Tipos de Documento. Es el primer catalogo del nuevo modulo
"Generales", donde se iran agregando catalogos de proposito general que no pertenecen a un modulo especifico
existente (Proyectos, Bancos, Promesas, Cuentas Cobrar).

---

## ENTIDAD

Mapeo exacto del schema `cartera.t_tipo_documento`. Los tipos deben coincidir con la BD.

```
TipoDocumento {
  cuenta:           varchar       -- gestionado por sistema (cuenta activa del usuario)
  empresa:          number        -- FK -> cartera.t_empresa.codigo
  proyecto:         number        -- FK -> cartera.t_proyecto.codigo, filtrado por empresa
  codigo:           number        -- parte del PK, gestionado por la base de datos.
  descripcion:      string        -- ingresado por el usuario
  agrego_usuario:   uuid          -- gestionado por sistema
  agrego_fecha:     timestamptz   -- gestionado por sistema
  modifico_usuario: uuid          -- gestionado por sistema
  modifico_fecha:   timestamptz   -- token de concurrencia optimista
}

TipoDocumentoForm {              -- campos editables por el usuario
  empresa:        number
  proyecto:       number
  descripcion:    string
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
getEmpresasUsuario()  -> prop 'empresas'   -> alimenta el Select de empresa
getProyectosUsuario() -> prop 'proyectos'  -> alimenta el Select de proyecto (filtrado por empresa)

Cascade doble: empresa → proyecto.
- Al cambiar empresa: resetear proyecto al primero disponible, y si no hubiera uno disponible resetear en blanco con valor 0.
```

> `getEmpresasUsuario` y `getProyectosUsuario` aplican `.eq('cuenta', cuenta)` internamente — el campo `cuenta` no aparece en ningún Select ni prop visible.

---

## ACCIONES

- Crear (INSERT) — requiere `puedeAgregar`
- Ver
- Editar (UPDATE — campos editables: `descripcion`) — requiere `puedeModificar`
- Eliminar (DELETE) — requiere `puedeEliminar`
- Listar con busqueda de texto y filtros por columna
- Exportar a CSV

## EXPORTACION

**Nombre de archivo:** `tipos-documento-YYYY-MM-DD.csv`

**Columna sticky izquierda a incluir siempre:** `codigo` (label: `"Codigo"`).

**Columnas que NUNCA se exportan** (aplica la lista global: `cuenta`, `agrego_usuario`, `modifico_usuario`).

---

## COLUMNAS_TABLA

Sticky izquierdo: `codigo` (label: `"Codigo"`, es el identificador visible del PK).
`STORAGE_KEY = 'tipos_documento_cols_v1_${userId}'`

> **Regla para FKs en la tabla:** nunca mostrar el ID numerico. Resolver al nombre legible:
> `empresa` → nombre de la empresa (prop `empresas`); `proyecto` → nombre del proyecto (prop `proyectos`).

| key         | label       | defaultVisible | render                     |
|-------------|-------------|----------------|----------------------------|
| empresa     | Empresa     | false          | nombre FK (prop `empresas`)  |
| proyecto    | Proyecto    | true           | nombre FK (prop `proyectos`) |
| descripcion | Descripcion | true           | valor directo               |

---

## MODAL_TITLES
| Modo   | Título                  |
|--------|-------------------------|
| nuevo  | Nuevo Tipo Documento    |
| editar | Editar Tipo Documento   |
| ver    | {descripcion}           |

---

## TABS_MODAL

### Tab: General  (icono: MapPin)

**[IDENTIFICACION]**

| Campo    | Label    | Ancho | View      | Nuevo                | Edit                     | Default (Nuevo)    | Notas |
|----------|----------|-------|-----------|-----------------------|--------------------------|---------------------|-------|
| empresa  | Empresa  | full  | ViewField | Select FK [§F]; req   | Select FK [§F]; disabled | primera disponible  | prop `empresas` |
| proyecto | Proyecto | full  | ViewField | Select FK [§F]; req   | Select FK [§F]; disabled | primero de empresa  | prop `proyectos` |
| codigo   | Codigo   | full  | ViewField | —                     | —                        | — (auto-asignado)   |       |

**[GENERAL]**

| Campo       | Label       | Ancho | View      | Nuevo / Edit  | Default (Nuevo) | Notas |
|-------------|-------------|-------|-----------|---------------|-----------------|-------|
| descripcion | Descripcion | full  | ViewField | Input [§D]; req | —             |       |

---

**PAGINACION:** NO (contador)

---

## REGLAS_ESPECIFICAS

1. `codigo` es inmutable tras la creacion (parte del PK compuesto). No puede editarse.
2. No puede existir duplicado de `descripcion` dentro del mismo `(cuenta, empresa, proyecto)`. Validar en backend antes del INSERT con `.eq('cuenta', cuenta).eq('empresa', ...).eq('proyecto', ...).eq('descripcion', ...)`.
3. **Validacion de similitud de nombre (frontend):** antes de llamar a `doSave()`, comparar la descripcion ingresada
   contra todos los tipos de documento del mismo `(empresa, proyecto)` usando `jaroWinkler(toDbString(form.descripcion), toDbString(x.descripcion)) >= 0.85` (importar `jaroWinkler, toDbString` de `@/lib/utils`). Si hay coincidencias, mostrar un `AlertDialog` que lista las descripciones similares y pregunta al usuario si desea continuar. El boton de confirmacion dice `"Si, es diferente — Continuar"` y llama a `doSave()`. Al editar, excluir el propio registro del analisis (`x.codigo !== viewTarget.codigo`).
4. Mostrar advertencia si `proyectos.length === 0` y deshabilitar el boton "Nuevo Tipo Documento".

---

## VALIDACIONES_BACKEND

- Duplicado: `descripcion` ya existe en el mismo `(cuenta, empresa, proyecto)` -> `'Ya existe un tipo de documento con esa descripcion en este proyecto.'`
- Concurrencia optimista en UPDATE: usar `modifico_fecha` como token. Si no hay filas actualizadas -> `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`

---

## LOGIC_ESPECIFICO

- Cascadas en `f()`: ver seccion **RELACIONES** para el detalle completo de la cascada empresa → proyecto.
- `openCreate()`: pre-seleccionar primera empresa y primer proyecto de esa empresa.

---

## QUERIES_TABLA

No requiere RPC ni queries especiales. Orden: `.order('empresa').order('proyecto').order('descripcion')`.

---

## CAMBIOS_PENDIENTES

> Solo se aplica cuando `MODO = actualizar`. Describe el delta exacto a aplicar sobre los archivos ya existentes.
> Vaciar esta sección (dejar solo esta instrucción) después de aplicar los cambios y devolver `MODO` a `nuevo`.

> _(sin cambios pendientes)_
