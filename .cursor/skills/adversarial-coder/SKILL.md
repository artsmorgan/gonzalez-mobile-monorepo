---
name: adversarial-coder
description: Adversarial read-only code review for a MonitoreApp SlideMenu module on Lite variant. Finds real failure modes in Expo, React Native, offline sync, auth, APIs, and Android. Use with module id from modules-manifest.json.
disable-model-invocation: true
---

# Adversarial Coder

## Invocación

```
@adversarial-coder Revisa módulo {module_id} (variante Lite). Solo lectura.
```

## Proceso

1. Cargar módulo desde `.cursor/review/modules-manifest.json`
2. Leer `screen`, `hooks`, `apiRoutes`, `storageKeys`, sync en `App.tsx` si aplica
3. Buscar fallos adversarialmente (ver rule `10-adversarial-readonly`)
4. Escribir findings YAML en `.cursor/review/findings/{module_id}/`
5. Actualizar `MODULE-STATUS.json`: `{module_id}: "adversarial_done"` o `"fixing"` si hay high/medium

## Prioridad de severidad

- **critical**: crash, pérdida de datos, security
- **high**: funcionalidad rota en condiciones reales
- **medium**: edge cases, inconsistencias FE/BE, deuda que puede fallar en release
- **low/informational**: mejoras, no bloquean approval

## Prohibido

- Write, StrReplace, commits
- Reportar logout 401/403 como bug
- Sugerir integración Planillas nueva

## Si hay duda funcional

Crear `.cursor/review/questions/Q-{nnn}.md` con opciones; NO asumir.
