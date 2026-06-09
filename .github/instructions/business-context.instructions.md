---
description: "Cartera — business domain context: who the clients are, cuenta/empresa/proyecto hierarchy, subscription model, and core business rules."
applyTo: "src/app/**/*.ts, src/app/**/*.tsx, src/lib/**/*.ts"
---

# Cartera — Contexto del Negocio

## Qué es Cartera

Plataforma SaaS para empresas que se dedican a la **lotificación de terrenos**. Estas empresas compran extensiones de tierra, las dividen en manzanas y lotes, y los venden a plazos a sus propios clientes.

Cartera gestiona las ventas, los planes de pago y los estados de cuenta de esos compradores.

---

## Quién es el cliente (la "cuenta")

El cliente de Cartera es la **empresa lotificadora** — no el comprador final del lote. Cada empresa lotificadora tiene una `cuenta` en el sistema, que es el identificador raíz de toda su información.

- **Un usuario Administrador por cuenta.** Es quien crea la cuenta y gestiona usuarios, empresas y proyectos. Tiene acceso irrestricto a todo. Su creación se gestiona en el proceso de alta de cuenta (pendiente de implementar).
- **El Administrador crea los usuarios internos** del sistema (personal administrativo) y les asigna permisos por proyecto y por funcionalidad.
- El campo `cuenta` actúa como **tenant ID** multi-tenant: toda tabla del schema `cartera` lo tiene y **toda query debe filtrarlo**.

---

## Jerarquía de datos

```
cuenta
 └── empresa          (una cuenta puede tener muchas empresas)
      └── proyecto    (una empresa puede tener muchos proyectos)
           └── fase   (máximo 2 fases por proyecto — ver regla abajo)
                └── manzana
                     └── lote
```

Entidades transversales al proyecto (no pertenecen a una fase específica):
- `cliente` — comprador de lotes
- `cobrador`, `supervisor`, `coordinador`, `vendedor` — personal del proyecto
- `banco`, `cuenta_bancaria`, `serie_recibo` — catálogos financieros

---

## Control de acceso por usuario

El acceso a datos se controla en tres capas que se aplican siempre en orden:

### Capa 1 — Tenant (obligatorio, inviolable)
Toda query filtra por `cuenta`. Un usuario de cuenta A nunca puede ver datos de cuenta B.
El valor se obtiene de `user.app_metadata.cuenta_activa` (JWT, seteado por Supabase Auth en login).

### Capa 2 — Empresa y Proyecto (`t_usuario_proyecto`)
Tabla: `cartera.t_usuario_proyecto (cuenta, userid, empresa, proyecto)`.
- **Sin filas para el usuario → sin acceso** (no hay fallback libre; el admin debe configurarlo siempre).
- **Con filas → solo esos proyectos** son visibles para ese usuario.
- El usuario Admin de la cuenta es la única excepción: tiene acceso irrestricto (gestionado en el proceso de creación de cuenta, aún pendiente).
- `t_empresa_usuario` fue eliminada; `t_usuario_proyecto` cubre tanto empresa como proyecto.

### Capa 3 — Visibilidad de datos dentro del proyecto (ventas y cobros)
Controlada por dos flags en `t_proyecto`:
- `visibilidad_ventas`: `0` = granular, `1` = abierto (todos ven todo el proyecto)
- `visibilidad_cobros`: `0` = granular, `1` = abierto

Con visibilidad granular (`0`), la visibilidad de datos sigue la jerarquía de roles operativos:

**Rama de ventas** (`t_supervisor` → `t_coordinador` → `t_vendedor`):
- Cada tabla tiene un campo `userid uuid NULL` que vincula al usuario de Supabase Auth.
- `t_vendedor.coordinador` → FK lógica a `t_coordinador.codigo` (mismo cuenta/empresa/proyecto).
- `t_coordinador.supervisor` → FK lógica a `t_supervisor.codigo` (mismo cuenta/empresa/proyecto).
- **Supervisor**: ve todo lo del proyecto (todas las promesas, recibos, reservas).
- **Coordinador**: ve las promesas/recibos/reservas de todos los vendedores bajo su coordinador.
- **Vendedor**: ve solo las promesas/recibos/reservas donde `vendedor = su código`.

**Rama de cobros** (`t_cobrador`):
- `t_cobrador.userid` vincula al usuario de Supabase Auth.
- **Cobrador**: ve solo los recibos de caja donde `cobrador = su código`.
- Permisos de anulación/eliminación de recibos propios: pendiente de implementar.

**Usuario administrativo sin rol operativo**: si el usuario tiene acceso al proyecto vía `t_usuario_proyecto` pero no aparece en ninguna tabla de rol operativo (`t_supervisor`, `t_coordinador`, `t_vendedor`, `t_cobrador`), ve todos los datos del proyecto.

Con visibilidad abierta (`1`): todos los usuarios con acceso al proyecto ven todos los datos, sin importar el rol operativo.

---

## Modelo de suscripción

- El cliente paga **por proyecto activo**, no por cuenta ni por empresa.
- Si un proyecto no paga, el sistema bloquea el acceso a ese proyecto específico (sin afectar los demás proyectos de la misma cuenta).
- Los datos de facturación y forma de pago se capturan por proyecto.

---

## Reglas de negocio críticas

### Límite de fases por proyecto
Un proyecto puede tener **máximo 2 fases**. Si el usuario necesita una tercera fase, debe crear un nuevo proyecto.
> A nivel de BD la estructura permite N fases — la restricción es solo de negocio, debe validarse en la Server Action `createFase`.

### Aislamiento de datos por cuenta
Ninguna query debe retornar datos de otra cuenta. El filtro `.eq('cuenta', cuenta)` es **obligatorio en toda operación**.
Si `cuenta` está vacía (sesión no válida), las operaciones de escritura deben retornar `{ error: 'Sesión no válida.' }` inmediatamente — ver patrón en `server-actions.instructions.md`.

### Acceso de usuarios finales (compradores de lotes)
Los compradores de lotes también tienen acceso a la plataforma, pero con un rol de solo lectura limitado a su propia información: estado de cuenta, facturas, pagos. Este módulo es futuro y no está implementado aún.
