# Cartera — Architecture Document

> Documento de arquitectura del sistema. Fuente de verdad para agentes de IA y desarrolladores nuevos.
> Última actualización: Mayo 2026

---

## 1. Qué es el sistema

**Cartera** es una plataforma SaaS para empresas de **lotificación de terrenos** (Guatemala). Estas empresas dividen tierras en manzanas y lotes y los venden a plazos a compradores finales. Cartera gestiona el ciclo completo: catálogos, ventas (promesas/reservas), cobranza y estados de cuenta.

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión relevante |
|------|-----------|-------------------|
| Framework | Next.js App Router | 16+ (breaking changes — ver §8) |
| Lenguaje | TypeScript strict | — |
| Base de datos | Supabase (PostgreSQL) | schema `cartera` |
| Auth | Supabase Auth | — |
| UI | Tailwind CSS + shadcn/ui | — |
| Componentes headless | **@base-ui/react** (NO Radix) | — |
| Iconos | Lucide React | — |
| Animaciones | Framer Motion (solo sidebar) | — |
| Toasts | Sonner | — |

> **Advertencia:** Los componentes headless son **@base-ui/react**, no Radix UI. Las APIs son diferentes — ver `base-ui-gotchas.instructions.md` antes de escribir cualquier componente interactivo.

---

## 3. Modelo de dominio

### Jerarquía de datos

```
cuenta                          ← tenant ID (raíz de todo)
 └── empresa                    ← una cuenta tiene N empresas
      └── proyecto              ← una empresa tiene N proyectos
           └── fase             ← máx. 2 fases ACTIVAS por proyecto (regla de negocio)
                └── manzana     ← t_manzana: tiene `codigo`, NO tiene `nombre`
                     └── lote
```

### Entidades transversales (pertenecen a cuenta, no a fase)

- **Personas:** `cliente`, `cobrador`, `supervisor`, `coordinador`, `vendedor`
- **Finanzas:** `banco`, `cuenta_bancaria`, `serie_recibo`, `tasa_cambio`, `tipo_ingreso`
- **Operaciones:** `promesa`, `reserva`

### Multi-tenancy

El campo `cuenta` actúa como **tenant ID** en todas las tablas del schema `cartera`.

- **Toda query debe filtrarlo:** `.eq('cuenta', cuenta)`
- La cuenta activa viene de `user.app_metadata.cuenta_activa`
- Si `cuenta` está vacía → las lecturas retornan 0 filas silenciosamente; las escrituras deben retornar `{ error: 'Sesión no válida.' }` inmediatamente

---

## 4. Arquitectura de capas

```
Browser
  │
  ├── Client Components (_client.tsx)
  │     └── Llaman Server Actions directamente
  │
  └── Server Components (page.tsx, layout.tsx)
        └── Llaman Server Actions para data fetching inicial
              │
              └── Server Actions (src/app/actions/*.ts)
                    ├── createClient()   ← cliente usuario (RLS activo)
                    └── createAdminClient() ← solo cuando RLS no aplica
                          │
                          └── Supabase PostgreSQL (schema cartera)
```

### Regla Server vs Client

- `page.tsx` → **siempre Server Component**. Hace el fetch inicial con `Promise.all`.
- `_client.tsx` → **siempre Client Component** (`"use client"`). Contiene estado, modales, tablas interactivas.
- Los datos fluyen de `page.tsx` → `_client.tsx` como props.
- Las mutaciones van de `_client.tsx` → Server Action → `router.refresh()` (recarga datos del servidor sin navegar).

---

## 5. Autenticación y autorización

### Flujo de sesión

1. `src/proxy.ts` intercepta todas las requests (equivalente a `middleware.ts` — ver §8).
2. Llama `updateSession()` que refresca el token JWT de Supabase en cada request.
3. `dashboard/layout.tsx` verifica `supabase.auth.getUser()` → si no hay usuario, `redirect('/login')`.
4. **Siempre usar `getUser()`**, nunca `getSession()` en el servidor — `getSession()` no valida el token contra el servidor.

### Modelo de permisos

- Los permisos se almacenan en `cartera.t_menu` por usuario.
- Se resuelven en `layout.tsx` con `getPermisosUsuario()` y se pasan al sidebar.
- Cada pantalla tiene un código de permiso definido en `src/lib/permisos.ts` (ej. `EMP.CAT`, `PRO.CAT`).
- La UI oculta/deshabilita acciones según `tienePermiso(permisos, PERMISOS.XXX)`.
- **Los permisos son solo UI** — las Server Actions no los verifican (la RLS de Supabase es la barrera real).

### Clientes Supabase

| Cliente | Archivo | Cuándo usar |
|---------|---------|-------------|
| Usuario | `src/lib/supabase/server.ts` → `createClient()` | Reads y writes normales (RLS activo) |
| Admin | `src/lib/supabase/admin.ts` → `createAdminClient()` | Solo cuando RLS no aplica o se necesitan privilegios elevados |

El cliente admin usa `SUPABASE_SERVICE_ROLE_KEY` — **nunca exponer al browser**.

---

## 6. Patrones de Server Actions

> Patrones completos en `server-actions.instructions.md`. Resumen:

- **`getCuentaActiva()`**: obtener `user.app_metadata.cuenta_activa` via `supabase.auth.getUser()`. Guard `if (!cuenta) return { error: ... }` en toda mutación. Toda query filtra `.eq('cuenta', cuenta)`.
- **`page.tsx`**: `Promise.all` con `.catch(() => [])` **por llamada individual** — nunca un try/catch global.
- **`modifico_fecha`**: toda tabla editable tiene este campo; el update lleva `.eq('modifico_fecha', modificoFecha)` para detectar concurrencia.
- **Exports**: solo `async function` y `export type`. Prohibido re-exportar valores desde `"use server"` — rompe el build (no detectable por `get_errors`).

---

## 7. Estructura de archivos

```
src/
  app/
    actions/          ← Server Actions (una entidad por archivo)
    dashboard/
      <modulo>/
        page.tsx      ← Server Component: fetch + props → _client
        _client.tsx   ← Client Component: estado, modales, tabla
    auth/callback/    ← Route Handler OAuth de Supabase
  components/
    layout/           ← AppSidebar
    ui/               ← Componentes shadcn/ui + custom
  lib/
    permisos.ts       ← Constantes PERMISOS (códigos de pantalla)
    constants.ts      ← Constantes globales (COUNTRY_CURRENCY_MAP, etc.)
    types/            ← Tipos TypeScript por entidad
    supabase/         ← Clientes Supabase (server, client, admin, middleware)
  proxy.ts            ← Interceptor de sesión (equivalente a middleware)
```

---

## 8. Decisiones técnicas clave (ADRs)

### ADR-01: `proxy.ts` en lugar de `middleware.ts`

**Next.js 16 deprecó `middleware.ts`.** El archivo de interceptor ahora es `src/proxy.ts` con `export function proxy(request)`. Renombrarlo a `middleware.ts` activa una advertencia de deprecación.

### ADR-02: `router.refresh()` en lugar de `revalidatePath()`

Después de mutaciones, se usa `router.refresh()` en el Client Component. Esto recarga los datos del Server Component sin navegar y mantiene el estado de UI local (scroll, tabs abiertas). `revalidatePath()` es más agresivo y puede causar parpadeos.

### ADR-03: Schema `cartera` separado del schema `public`

Todas las tablas de negocio están en el schema `cartera`, no en `public`. Las queries usan `admin.schema('cartera').from('t_...')`. Para que PostgREST lo exponga se requiere:

```sql
ALTER ROLE authenticator SET "pgrst.db_schemas" = 'public, storage, graphql_public, cartera';
NOTIFY pgrst, 'reload config';
```

### ADR-04: @base-ui/react en lugar de Radix UI

Los componentes headless usan `@base-ui/react`. Diferencias críticas:
- `DropdownMenuTrigger`: no tiene `asChild` — usar `className` directamente
- `SelectValue`: es un render prop, no un componente que acepta `children` estático
- `SelectTrigger`: necesita `className="w-full"` explícito
- `AlertDialogDescription`: usar `render={<div />}` para cambiar el elemento raíz; nunca poner `<p>` dentro (genera error de hidratación)

### ADR-05: Sin `dangerouslySetInnerHTML`

Prohibido en todo el codebase. React escapa los valores por defecto — no hay justificación para bypasearlo.

### ADR-06: `admin.schema('cartera')` para todas las queries

Las queries de Server Actions usan el cliente admin (o user) con `.schema('cartera')` explícito. Sin esto, PostgREST busca en `public` y no encuentra las tablas.

---

## 9. Seguridad (OWASP)

| Amenaza | Mitigación |
|---------|-----------|
| SQL Injection | Cliente Supabase con queries parametrizadas — nunca interpolar strings |
| XSS | Sin `dangerouslySetInnerHTML`. React escapa por defecto |
| CSRF | Server Actions de Next.js incluyen protección CSRF nativa |
| Broken Access Control | Toda query filtrada por `cuenta`. RLS de Supabase como barrera de fondo |
| Security Misconfiguration | `SUPABASE_SERVICE_ROLE_KEY` nunca al cliente. Variables públicas con prefijo `NEXT_PUBLIC_` |
| Broken Authentication | `getUser()` siempre (valida token en servidor). Nunca `getSession()` |

---

## 10. Módulos del dashboard

| Módulo | Ruta | Permiso |
|--------|------|---------|
| Home | `/dashboard/home` | `DASH.HOM` |
| KPIs | `/dashboard/kpis` | `DASH.KPI` |
| Empresas | `/dashboard/proyectos/empresas` | `EMP.CAT` |
| Proyectos | `/dashboard/proyectos/proyectos` | `PRO.CAT` |
| Fases | `/dashboard/proyectos/fases` | `FAS.CAT` |
| Manzanas | `/dashboard/proyectos/manzanas` | `MAN.CAT` |
| Lotes | `/dashboard/proyectos/lotes` | `LOT.CAT` |
| Bancos | `/dashboard/bancos/bancos` | `BAN.CAT` |
| Cuentas bancarias | `/dashboard/bancos/cuentas-bancarias` | `CUE.BAN` |
| Tasas de cambio | `/dashboard/bancos/tasas-cambio` | `TSC.CAT` |
| Clientes | `/dashboard/clientes` | `CLI.CAT` |
| Supervisores | `/dashboard/supervisores` | `SUP.CAT` |
| Vendedores | `/dashboard/vendedores` | `VEN.CAT` |
| Cobradores | `/dashboard/cobradores` | `COB.CAT` |
| Coordinadores | `/dashboard/coordinadores` | `COO.CAT` |
| Series de recibos | `/dashboard/cuentas-cobrar/series-recibos` | `SER.REC` |
| Tipos de ingreso | `/dashboard/cuentas-cobrar/tipos-ingresos` | `TIN.CAT` |
| Promesas | `/dashboard/promesas` | — |

---

## 11. Lo que NO está implementado aún

- Portal del comprador final (solo lectura de su estado de cuenta)
- Módulo de cobranza y generación de recibos
- Reportes financieros
- Facturación electrónica
