---
name: coder-approval
description: Global pre-commit approval for test-soft-001 Lite after all SlideMenu modules reviewed. Validates architecture consistency, diff vs baseline, TypeScript, lint, build, and no open high/medium findings.
disable-model-invocation: true
---

# Coder Approval

## Invocación

```
@coder-approval Revisión global test-soft-001 Lite
```

## Checklist

- [ ] Todos los módulos in-scope en `MODULE-STATUS.json` = `approved`
- [ ] 0 findings high/medium con `status: open`
- [ ] Questions abiertas = 0
- [ ] `git diff soft-001-baseline --stat` sin archivos fuera de alcance
- [ ] Sin secretos en diff (`.env`, google-services, tokens)
- [ ] Sin código debug temporal
- [ ] Consistencia FE ↔ BE por módulo tocado
- [ ] Fixes resuelven findings documentados

## Validaciones (ejecutar y registrar salida)

```powershell
cd apps/mobile; npx tsc --noEmit; npm run lint
cd apps/server; npx tsc --noEmit; npm run build
cd apps/mobile; npx expo-doctor
node --test apps/server/utils/*.test.ts
```

`expo-doctor`: recomendado, no gate — documentar resultado.

## Salida

Generar `.cursor/review/APPROVAL.md`:

```markdown
# APPROVAL — test-soft-001

status: PASS | FAIL
date: ISO8601
baseline: soft-001-baseline
variant: lite

## Validaciones
(pegar resultados)

## Diff summary
(resumen)

## Findings pendientes
(lista o "ninguno")

## Notas
```

Solo `status: PASS` permite commit (hook lo verifica).

## Prohibido

- Hacer commit (lo ejecuta el humano)
- Aprobar con high/medium abiertos
