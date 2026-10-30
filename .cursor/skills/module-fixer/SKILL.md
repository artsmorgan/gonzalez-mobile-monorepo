---
name: module-fixer
description: Fix a single adversarial finding in MonitoreApp with minimal scoped changes aligned to existing architecture. Use after adversarial-coder with finding id F-xxx and module id.
disable-model-invocation: true
---

# Module Fixer

## Invocación

```
@module-fixer Corrige finding {finding_id} del módulo {module_id}
```

## Proceso

1. Leer `.cursor/review/findings/{module_id}/{finding_id}.yaml`
2. Escribir `{module_id}` en `.cursor/review/ACTIVE-MODULE.txt`
3. Leer archivos afectados + contexto (hooks, API, sync)
4. Si `questions/` tiene items `status: open` para este módulo → STOP
5. Implementar fix mínimo solo en `allowedPaths` del manifiesto
6. Escribir `{finding_id}-fix.md` (qué cambió, cómo verificar)
7. Ejecutar `.cursor/review/scripts/validate-module.ps1 -ModuleId {module_id}`
8. Actualizar finding `status: fixed` o `blocked`

## Prohibido

- Commits
- Cambios fuera de `allowedPaths` sin finding que lo autorice
- Modificar `.env`, `google-services*.json`, `package.json`
- “Arreglar” logout 401/403 en authedFetch

## Escalación

Si no se puede determinar comportamiento esperado → question + `status: blocked`.
