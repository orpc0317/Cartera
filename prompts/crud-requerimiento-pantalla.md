# Cómo solicitar desarrollo de una pantalla CRUD

---

## Pantalla nueva

1. Verificar que el spec tenga `MODO = nuevo`
2. En el chat de Copilot (modo **Agent**):

```
/desarrollar-pantalla #file:prompts/crud-bancos.md
```

---

## Actualizar una pantalla existente

1. Abrir el spec correspondiente (ej. `prompts/crud-fases.md`)
2. Cambiar `MODO` de `nuevo` a `actualizar`
3. Describir los cambios exactos en la sección `CAMBIOS_PENDIENTES`
4. Guardar el spec
5. En el chat de Copilot (modo **Agent**):

```
/desarrollar-pantalla #file:prompts/crud-fases.md
```

> El AI aplicará **únicamente** los cambios listados en `CAMBIOS_PENDIENTES`,
> luego restablecerá `MODO = nuevo` y vaciará `CAMBIOS_PENDIENTES` automáticamente.

