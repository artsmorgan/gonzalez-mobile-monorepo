# MonitoreApp — Estatus de proyecto

**Monorepo:** `gonzalez-mobile-monorepo`  
**Apps:** MonitoreApp (Expo/React Native) + servidor Next.js/Prisma  
**Alcance analizado:** ~79 pantallas móviles, ~256 rutas API, integración con Planillas (González)

---

## Resumen ejecutivo

El proyecto está **muy avanzado**. La mayor parte del trabajo pendiente **no es construir pantallas nuevas**, sino:

1. Habilitar la **conexión servidor ↔ ambiente González** (proxy/API Planillas).
2. Cerrar **brechas puntuales** de sincronización offline y validación.
3. Hacer **pruebas menores** del soft-release antes de liberar.

**Avance global estimado:** ~90–95%  
**Pendiente estimado:** ~12–18 sesiones para el soft-release · ~45–55 sesiones para el producto completo

---

## Estatus por lanes

> Una **lane** = un bloque funcional del producto.  
> Progreso = implementación + integración (no incluye QA formal de producción).

### Soft-release (prioridad inmediata)

| Lane                                                      | Progreso            | Estado     | Pendiente principal                                                              |
| --------------------------------------------------------- | ------------------- | ---------- | -------------------------------------------------------------------------------- |
| **Monitoreo** (marcar ingreso/salida, control asistencia) | ██████████ **100%** | Completado | Validar marcas vía Planillas en ambiente real; casos offline de salida/reversión |
| **Tiempo de alimentación**                                | ██████████ **100%** | Completado | Prueba de sincronización de minutos con horario Planillas                        |
| **Ubicación del puesto**                                  | ██████████ **100%** | Completado | Validar proxy GPS (`PUT /puestos/{id}/coordenadas`) en ambiente González         |
| **Entrega de puestos**                                    | ██████████ **100%** | Completado | Validar en ambiente real                                                         |
| **Nomencladores**                                         | ██████████ **100%** | Completado | Validar vía Planillas en ambiente real                                           |
| **Solicitud de permiso**                                  | ██████████ **100%** | Completado | Validar vía Planillas en ambiente real                                           |
| **Mutuos acuerdos**                                       | ██████████ **100%** | Completado | Validar vía Planillas en ambiente real                                           |
| **Mantenimiento de equipo**                               | ██████████ **100%** | Completado | Validar bulk / Planillas en ambiente real                                        |
| **Checklist supervisión**                                 | ██████████ **100%** | Completado | Validar en ambiente real                                                         |
| **Actividades**                                           | ██████████ **100%** | Completado | Validar en ambiente real                                                         |
| **Traslado de plazas**                                    | ██████████ **100%** | Completado | Validar upload vía Planillas en ambiente real                                    |

**Promedio soft-release:** ~**100%**

---

### Plataforma e infraestructura

| Lane                                                        | Progreso            | Estado      | Pendiente principal                                    |
| ----------------------------------------------------------- | ------------------- | ----------- | ------------------------------------------------------ |
| **Auth y sesión** (JWT móvil + token Planillas)             | ██████████ **100%** | Completado  | Validar en ambiente real                               |
| **Sincronización offline** (colas AsyncStorage + `App.tsx`) | ██████████ **100%** | Completado  | Validar en ambiente real                               |
| **Jerarquía / main-structure**                              | ██████████ **100%** | Completado  | Validar en ambiente real                               |
| **Integración Planillas (proxy BFF)**                       | ░░░░░░░░░░ **0%**   | Sin iniciar | **Bloqueado por accesos y ambiente del equipo Carlos** |
| **Reportes** (30+ módulos + worker)                         | ██████████ **100%** | Completado  | Validar en ambiente real                               |

---

### Módulos secundarios (fuera del soft-release)

| Lane                             | Progreso | Notas                       |
| -------------------------------- | -------- | --------------------------- |
| Notas                            | 90%      | Offline operativo; falta QA |
| Notas de voz                     | 90%      | Offline operativo; falta QA |
| Visitantes                       | 90%      | Offline operativo; falta QA |
| Vehículos (visitas)              | 90%      | Offline operativo; falta QA |
| Vehículos corporativos           | 85%      | Implementado; falta QA      |
| Bitácora vehículos detenidos     | 85%      | Implementado; falta QA      |
| Incidentes                       | 90%      | Offline operativo; falta QA |
| Capacitaciones                   | 90%      | Offline operativo; falta QA |
| Manuales de trabajo              | 95%      | Offline operativo; falta QA |
| Evaluaciones de personal         | 85%      | Implementado; falta QA      |
| Encuestas de satisfacción        | 85%      | Implementado; falta QA      |
| Control de asistencia (planilla) | 90%      | Implementado; falta QA      |
| Apertura / cierre de puesto      | 90%      | Implementado; falta QA      |
| Agenda / minuta física           | 85%      | Implementado; falta QA      |
| Llaves / llaveros                | 85%      | Offline operativo; falta QA |
| Acta de entrega de productos     | 85%      | Implementado; falta QA      |
| Documentos entregados            | 85%      | Implementado; falta QA      |
| Producto no conforme             | 85%      | Implementado; falta QA      |
| Maestro de quejas                | 85%      | Implementado; falta QA      |
| Apreciación de vulnerabilidad    | 85%      | Implementado; falta QA      |
| Inducción recorrido              | 85%      | Implementado; falta QA      |
| Registro de inducción general    | 85%      | Implementado; falta QA      |
| Firma digital                    | 95%      | Operativo; falta QA formal  |

---
