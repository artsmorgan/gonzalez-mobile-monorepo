# Tablas DB usadas en apps/server (incluyendo include, sin IDs UUID)

## Criterio

- Fuente: todos los archivos `.ts` dentro de `apps/server`.
- Detección:
  - `callDynamicPrisma({ data: { table: "..." } })`
  - `prisma.<model>` (mapeado a tabla real via `@@map` en `schema.prisma`).
  - Relaciones usadas por `include` en consultas Prisma (incluye `include` anidados).
- Exclusión aplicada: tablas cuyo campo `id` usa UUID/CUID en `schema.prisma`.

## Total incluidas: 91

1. `a_recovery_password_token`
2. `c_accion_personal`
3. `c_acta_entre_producto`
4. `c_agenda_minuta`
5. `c_anexos_quejas`
6. `c_apertura_cierre_puesto`
7. `c_archivos_adjuntos_articulo_mantenimiento`
8. `c_archivos_aporte_incidente`
9. `c_archivos_incidente`
10. `c_articulo_mantenimiento`
11. `c_bitacora_vehiculo_detenido`
12. `c_boleta_apreciacion_vulnerabilidad`
13. `c_cambio_guardia`
14. `c_cambios_apps_modules`
15. `c_categoria_mantenimiento`
16. `c_checklist_supervision`
17. `c_contribucion_incidente`
18. `c_control_asistencia`
19. `c_empleado`
20. `c_empleado_almuerzo`
21. `c_empleado_notification`
22. `c_empleado_plaza`
23. `c_encuesta_cliente`
24. `c_evaluacion_empleado`
25. `c_horario`
26. `c_imagenes_acta_entrega_producto`
27. `c_imagenes_apertura_cierre_puesto`
28. `c_imagenes_control_asistencia`
29. `c_imagenes_registro_induccion_general`
30. `c_imagenes_vehiculos_corporativos`
31. `c_incidente`
32. `c_maestro_quejas`
33. `c_mantenimiento_vehiculos_corporativos`
34. `c_marca_dia`
35. `c_movimientos_articulo_mantenimiento`
36. `c_notifications`
37. `c_plaza_notification`
38. `c_producto_no_conforme`
39. `c_puesto_notas`
40. `c_puesto_notas_bitacora_cambios`
41. `c_registro_induccion_general`
42. `c_registro_induccion_recorrido`
43. `c_salida_anticipada`
44. `c_solicitud_permiso`
45. `c_tipo_accion`
46. `c_tipos_producto_no_conforme`
47. `c_usos_vehiculos_corporativos`
48. `c_vehiculos_corporativos`
49. `e_actividades`
50. `e_actividades_puesto`
51. `e_actividades_puesto_plaza`
52. `e_activo_visitante`
53. `e_archivos_manual_puesto`
54. `e_archivos_producto_no_conforme`
55. `e_capacitacion_empleado`
56. `e_capacitacion_puesto`
57. `e_control_documento_entregado_cliente`
58. `e_empleado_visualizacion_archivos`
59. `e_empleado_visualizacion_manual_puesto`
60. `e_estructura_articulo_corpo_puesto_entrega`
61. `e_estructura_articulo_corpo_puesto_plan`
62. `e_estructura_cliente`
63. `e_estructura_combo_articulo_cp`
64. `e_estructura_contrato`
65. `e_estructura_empresa`
66. `e_estructura_plazas`
67. `e_estructura_puesto`
68. `e_estructura_sucursal`
69. `e_llave`
70. `e_llave_en_llavero`
71. `e_llavero`
72. `e_manual_puesto`
73. `e_movimiento_llave`
74. `e_movimiento_llavero`
75. `e_mutuos_acuerdos`
76. `e_puestos_manual_puesto`
77. `e_registro_capacitaciones`
78. `e_registro_entrega_puesto`
79. `e_registro_personas`
80. `e_registro_vehiculos`
81. `e_tipo_documento`
82. `n_articulo_corpo_puesto`
83. `n_clasificacion_incidente`
84. `n_division`
85. `n_ejecutivo_cuenta`
86. `n_novedades_categoria`
87. `n_tipo_activo_visitas`
88. `n_tipo_mantenimiento_articulo`
89. `pg_categoria_empleado`
90. `pg_categoria_salarial`
91. `refresh_token`

## Detectadas solo via include (no directas): 0

- Ninguna

## Excluidas por ID UUID/CUID: 28

1. `c_control_acciones_mejora`
2. `c_control_aseadores`
3. `c_control_kilometraje`
4. `c_cronograma_entrega_materiales_equipos`
5. `c_datos_basicos_contrato`
6. `c_guia_uso_cepillo_electrico`
7. `c_informe_supervision`
8. `c_listado_general_clientes`
9. `c_matriz_analisis_partes_interesadas`
10. `c_matriz_gestion_conocimiento`
11. `c_matriz_indicador_procesos`
12. `c_matriz_oportunidades`
13. `c_matriz_riesgos`
14. `c_objetivos_empresariales_calidad`
15. `c_plan_accion`
16. `c_plan_atencion_situaciones_especiales`
17. `c_plan_comunicacion`
18. `c_plan_gestion_ambiental`
19. `c_plan_trabajo_aseo_limpieza`
20. `c_planificacion_cambios_sgc`
21. `c_planificacion_mantenimiento_vehiculo`
22. `c_politica_calidad`
23. `c_registro_tareas_actividades_limpieza`
24. `c_rol_trabajo`
25. `c_rol_trabajo_mensual`
26. `c_rutas_giras`
27. `c_satisfaccion_personal`
28. `c_solicitud_uniforme`
