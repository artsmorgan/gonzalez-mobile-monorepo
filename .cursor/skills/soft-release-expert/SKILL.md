---
name: soft-release-expert
description: Expert context for MonitoreApp test-soft-001 on Expo SDK 54 Lite and Next.js BFF. Use at start of review branch to map architecture, conventions, and module dependencies before adversarial or fix passes.
disable-model-invocation: true
---

# Soft-Release Expert (MonitoreApp Lite)

## Stack

- Monorepo: `apps/mobile` (Expo 54, RN 0.81, React Navigation via `App.tsx`) + `apps/server` (Next.js 15, Prisma/MySQL)
- Variante: **Lite** — `APP_VARIANT=lite`, `com.abrjpo98.MonitoreApp.lite`, `google-services-lite.json`, EAS `preview-lite`
- Auth: JWT en AsyncStorage + token Planillas para sync selectiva
- Offline: colas `*_actions` procesadas en `App.tsx` (~8000 LOC)
- Jerarquía: `main-structure` fragmentado + caches locales
- Visibilidad módulos: `n_app_module_visibility` → `/api/modules-release` → `SlideMenu.releaseAction()`

## Convenciones

| Capa | Patrón |
|------|--------|
| UI | `apps/mobile/screens/{Name}Screen.tsx` |
| Lógica mobile | `hooks/{module}Functions.ts`, `*CacheHelpers.ts`, `*Sync.ts` |
| API | `apps/server/app/api/{kebab-case}/` |
| Reportes | `server/utils/reports-functions/` + `ReportesScreen` |

## Intencional (no cambiar)

- `authedFetch`: logout en 401/403 sin retry
- Integración Planillas: usar implementación existente

## Tareas al invocar

1. Leer `.cursor/review/modules-manifest.json`
2. Generar/actualizar `.cursor/review/ARCHITECTURE.md` con dependencias transversales
3. Confirmar orden de revisión en `MODULE-STATUS.json`
4. NO modificar código de la app

## Referencias internas

- `ESTATUS_PROYECTO.md` — estado por lane
- `apps/mobile/components/SlideMenu.tsx` — módulos in-scope
- `apps/mobile/ARCHIVOS_SIN_REFRESH_TOKEN_401_403.md` — auth patterns
