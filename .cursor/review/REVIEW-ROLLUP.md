# Soft-release Lite — Review Rollup

**Branch:** `test-soft-001` | **Variant:** Lite | **Phase:** 5-adversarial-complete (fixes cerrados)  
**Updated:** 2026-07-31

## Estado global

- **41/41** módulos `approved`
- **0** findings abiertos
- Findings en `.cursor/review/findings/` con `F-xxx-fix.md` asociados

## Última tanda de fixes (cola final)

| Módulo | Finding | Resolución |
|--------|---------|------------|
| non-conforming-product | F-001 | Adjuntos offline en disco (`nonConformingProductFilesSync.ts`) |
| checklist-supervision | F-004 | Soft delete `isActive: false` en servidor |
| physical-minute-agenda | F-002 | Normalización `physical_minute_agenda` → `agenda_minuta` |
| job-manuals | F-002 | `horaAccion` con `Number.isFinite` (ya aplicado) |
| attendance-control | F-001/F-003/F-004 | Online-only documentado; total recalculado en servidor |
| reportes / complaints / llaves | F-002/F-004/F-003 | Informational — documentado/cerrado |

## Fixes cross-cutting (acumulado)

1. **`cleanAsyncStorage`** — preserva claves `*_actions`
2. **`ACTION_STORAGE_KEYS`** — `lunchtime_actions` alineado
3. **`getActivities`** — no borra cola antes del fetch
4. **`collectPendingSyncLocalFileNames`** — incluye `stored_file_name`
5. **`deleteAllFiles(preserveNames)`** — no borra archivos referenciados por colas offline

## Siguiente paso

- Ejecutar `@coder-approval` → `APPROVAL.md` PASS
- Commit único cuando el usuario lo solicite
