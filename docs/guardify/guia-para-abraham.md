# Guía para Abraham: cómo trabajar con Guardify

Guardify es el plano de control de las apps de la suite. MonitoreApp **implementa** lo que Guardify **define** (reportes, filtros, formularios, dispositivos, documentos). Esta guía te dice dónde está todo y qué trabajo te toca.

## Reglas de oro
1. **Solo se toca la base de datos de Guardify.** La base de Planillas (tercero) es de solo lectura: nada de cambios de esquema, índices ni escrituras.
2. **No hagas push directo a `main`.** `main` se despliega solo a staging (https://guardifyconsole-production.up.railway.app) y ejecuta migraciones. Trabaja en una rama (`abraham/<tema>`) y abre un PR; Aletz lo revisa. (GitHub no permite proteger la rama en este plan, así que depende de nosotros.)
3. **Nunca subas secretos** (llaves, contraseñas, cadenas de conexión). Van en variables de Railway.
4. Lo de MonitoreApp se trabaja en su repo (`artsmorgan/gonzalez-mobile-monorepo`), con ramas y PR hacia `servidor`.

## Dónde está cada cosa
| Qué | Dónde |
|---|---|
| Qué es Guardify y cómo correrlo | `README.md` |
| Arquitectura de identidad y dispositivos | `docs/arquitectura-identidad-y-dispositivos.md` |
| Decisiones del cliente (20 oct 2026) | `docs/decisiones-cliente-2026-10-20.md` |
| Plan de dispositivos | `docs/plan-implementacion-dispositivos.md` |
| Auditoría de MonitoreApp | `docs/auditoria-monitoreapp-dispositivos.md` |
| **Contrato de reportes** (filtros, columnas estándar, evidencia, huella de firma) | `docs/protocolo-reportes.md` |
| **Contrato de formularios** (registro, evidencia, adjuntos) | `docs/protocolo-formularios.md` |
| **Contrato de documentos** (publicar, vista previa, enviar) | `docs/protocolo-documentos.md` |
| SDK de dispositivo (app y servidor) | `packages/sdk` (README y CHANGELOG); copia lista en MonitoreApp: `vendor/guardify-sdk` |
| Esquemas compartidos (zod) | `packages/contracts` |

## Correr Guardify en tu máquina
```bash
bun install
bun run infra:up      # PostgreSQL y buzón de correo de pruebas (Docker)
bun run db:generate && bun run db:deploy && bun run db:seed
bun run dev           # consola en http://localhost:3000
bun run worker        # en otra terminal
bunx vitest run e2e/f30.test.ts   # ejemplo: una prueba de extremo a extremo (necesita consola y worker en marcha)
```
Las pruebas `e2e/mock-monitoreapp.ts` simulan el servidor de MonitoreApp: sirven de ejemplo vivo de cada contrato (reportes, formularios, adjuntos, documentos).

## Tu trabajo, en orden sugerido
Los tickets están en `artsmorgan/gonzalez-mobile-monorepo` (épica #161). Lo que Guardify ya tiene listo y espera a la app:

| Ticket | Qué necesita Guardify de la app | Contrato |
|---|---|---|
| #145–#148 | Registrar el equipo, latidos y órdenes, actualizar desde el catálogo de APK | `packages/sdk/README.md` |
| #149–#150 | Consultar equipos no activos y rechazar equipos no aprobados en el servidor | `createVerifier` en el SDK |
| #151–#153 | Algoritmo de firma (huella) y tabla de evidencia | `protocolo-reportes.md` → «Evidencia» |
| #137, #152 | Latitud, longitud y dispositivo en cada registro | ídem |
| #155–#157 | Versiones de documentos y API para publicar/enviar | `protocolo-documentos.md` |
| #156 | Nota del quiz consolidada | columna `nota_promedio` |
| #138–#143 | Columnas nuevas de reportes | `protocolo-reportes.md` |

Cuando una columna o endpoint esté listo en la app, avisa en el ticket de Guardify correspondiente para publicar el manifiesto (`bun scripts/publish-monitoreapp.ts --apply`, con `--evidencia` o `--documentos` según el caso).

## Cómo avisar y pedir cosas
- Dudas de un contrato: comenta en el ticket de Guardify (`artsmorgan/guard-desk-nexus`) que corresponda.
- Si un contrato no te sirve tal cual, propón el cambio en un PR a su `docs/protocolo-*.md`; se ajusta antes de programar.
