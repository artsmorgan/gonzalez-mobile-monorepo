# MonitoreApp — Flujo multi-agente test-soft-001

Rama de revisión adversarial para soft-release **Lite**.

## Inicio rápido

```
@soft-release-expert Genera/actualiza ARCHITECTURE.md para test-soft-001 Lite
```

## Flujo por módulo

```
@adversarial-coder Revisa módulo {id} (Lite). Solo lectura.
  → findings en .cursor/review/findings/{id}/F-xxx.yaml

@module-fixer Corrige finding F-xxx del módulo {id}
  → escribe ACTIVE-MODULE.txt antes de editar apps/

@coder-approval Revisión global test-soft-001 Lite
  → genera APPROVAL.md (status: PASS requerido para commit)
```

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `.cursor/review/modules-manifest.json` | 41 módulos + allowedPaths |
| `.cursor/review/MODULE-STATUS.json` | pending → approved |
| `.cursor/review/ACTIVE-MODULE.txt` | Módulo activo para Coder |
| `.cursor/review/APPROVAL.md` | Veredicto final pre-commit |

## Skills

| Skill | Rol |
|-------|-----|
| `soft-release-expert` | Contexto arquitectónico (read-only) |
| `adversarial-coder` | Revisión adversarial (read-only) |
| `module-fixer` | Corrección acotada |
| `coder-approval` | Aprobación global |

## Reglas

- `.cursor/rules/00-soft-release-guardrails.mdc` — alwaysApply
- `.cursor/rules/10-adversarial-readonly.mdc`
- `.cursor/rules/20-coder-scoped.mdc`

## Hooks

- Escritura en `apps/` requiere `ACTIVE-MODULE.txt`
- `git commit` bloqueado hasta `APPROVAL.md` con `status: PASS`
- Rutas protegidas: `.env`, `google-services*.json`, `package.json`

## Validación por módulo

```powershell
.cursor/review/scripts/validate-module.ps1 -ModuleId activities
```

## Git

- Baseline: tag `soft-001-baseline`
- Commit único al final tras approval PASS
- Stash WIP previo: `WIP pre test-soft-001`

## Orden recomendado (primeros módulos)

1. platform-auth
2. platform-offline-sync
3. platform-lite-config
4. marcar-ingreso-salida
5. lunch-time
6. permit-request
7. … (ver MODULE-STATUS.json)
