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

- **Un usuario Administrador por cuenta.** Es quien crea la cuenta y gestiona usuarios, empresas y proyectos.
- **El Administrador crea los usuarios internos** del sistema (personal administrativo) y les asigna permisos por proyecto y por funcionalidad.
- El campo `cuenta` actúa como **tenant ID** multi-tenant: toda tabla del schema `cartera` lo tiene y **toda query debe filtrarlo**.

---

## Jerarquía de datos

```
cuenta
 └── empresa          (una cuenta puede tener muchas empresas)
      └── proyecto    (una empresa puede tener muchos proyectos)
           └── fase   (máximo 2 fases activas por proyecto — ver regla abajo)
                └── manzana
                     └── lote
```

Entidades transversales al proyecto (no pertenecen a una fase específica):
- `cliente` — comprador de lotes
- `cobrador`, `supervisor`, `coordinador`, `vendedor` — personal del proyecto
- `banco`, `cuenta_bancaria`, `serie_recibo` — catálogos financieros

---

## Modelo de suscripción

- El cliente paga **por proyecto activo**, no por cuenta ni por empresa.
- Si un proyecto no paga, el sistema bloquea el acceso a ese proyecto específico (sin afectar los demás proyectos de la misma cuenta).
- Los datos de facturación y forma de pago se capturan por proyecto.

---

## Reglas de negocio críticas

### Límite de fases por proyecto
Un proyecto puede tener **máximo 2 fases activas**. Si el usuario necesita una tercera fase, debe crear un nuevo proyecto.
> A nivel de BD la estructura permite N fases — la restricción es solo de negocio, debe validarse en la Server Action `createFase`.

### Aislamiento de datos por cuenta
Ninguna query debe retornar datos de otra cuenta. El filtro `.eq('cuenta', cuenta)` es **obligatorio en toda operación**.
Si `cuenta` está vacía (sesión no válida), las operaciones de escritura deben retornar `{ error: 'Sesión no válida.' }` inmediatamente — ver patrón en `server-actions.instructions.md`.

### Acceso de usuarios finales (compradores de lotes)
Los compradores de lotes también tienen acceso a la plataforma, pero con un rol de solo lectura limitado a su propia información: estado de cuenta, facturas, pagos. Este módulo es futuro y no está implementado aún.
