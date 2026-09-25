# Modelos de `schema-modificado` que no están en `schema-original`

Se listan los modelos que aparecen en `apps/server/docs/schema-modificado.txt` y no aparecen en `apps/server/docs/schema-original.txt`, excluyendo los que están en la sección **Excluidas por ID UUID/CUID** de `apps/server/docs/mobile-referenced-db-tables.md`.

## Total creadas: 69

1. `a_recovery_password_token`
2. `c_acta_entre_producto`
3. `c_agenda_minuta`
4. `c_anexos_quejas`
5. `c_apertura_cierre_puesto`
6. `c_archivos_adjuntos_articulo_mantenimiento`
7. `c_archivos_aporte_incidente`
8. `c_archivos_incidente`
9. `c_articulo_mantenimiento`
10. `c_bitacora_vehiculo_detenido`
11. `c_boleta_apreciacion_vulnerabilidad`
12. `c_cambios_apps_modules`
13. `c_categoria_mantenimiento`
14. `c_checklist_supervision`
15. `c_contribucion_incidente`
16. `c_control_asistencia`
17. `c_empleado_almuerzo`
18. `c_empleado_notification`
19. `c_encuesta_cliente`
20. `c_evaluacion_empleado`
21. `c_imagenes_acta_entrega_producto`
22. `c_imagenes_apertura_cierre_puesto`
23. `c_imagenes_control_asistencia`
24. `c_imagenes_registro_induccion_general`
25. `c_imagenes_vehiculos_corporativos`
26. `c_incidente`
27. `c_maestro_quejas`
28. `c_mantenimiento_vehiculos_corporativos`
29. `c_movimientos_articulo_mantenimiento`
30. `c_notifications`
31. `c_plaza_notification`
32. `c_producto_no_conforme`
33. `c_puesto_notas`
34. `c_puesto_notas_bitacora_cambios`
35. `c_registro_induccion_general`
36. `c_registro_induccion_recorrido`
37. `c_solicitud_permiso`
38. `c_tipos_producto_no_conforme`
39. `c_usos_vehiculos_corporativos`
40. `c_vehiculos_corporativos`
41. `e_actividades`
42. `e_actividades_puesto`
43. `e_actividades_puesto_plaza`
44. `e_activo_visitante`
45. `e_archivos_manual_puesto`
46. `e_archivos_producto_no_conforme`
47. `e_capacitacion_empleado`
48. `e_capacitacion_puesto`
49. `e_control_documento_entregado_cliente`
50. `e_empleado_visualizacion_archivos`
51. `e_empleado_visualizacion_manual_puesto`
52. `e_llave`
53. `e_llave_en_llavero`
54. `e_llavero`
55. `e_manual_puesto`
56. `e_movimiento_llave`
57. `e_movimiento_llavero`
58. `e_mutuos_acuerdos`
59. `e_puestos_manual_puesto`
60. `e_registro_capacitaciones`
61. `e_registro_entrega_puesto`
62. `e_registro_personas`
63. `e_registro_vehiculos`
64. `e_tipo_documento`
65. `n_clasificacion_incidente`
66. `n_novedades_categoria`
67. `n_tipo_activo_visitas`
68. `n_tipo_mantenimiento_articulo`
69. `refresh_token`

## Tablas en "Total incluidas" de mobile-referenced-db-tables.md que NO están en esta lista

Tablas que aparecen en la sección **Total incluidas** de `apps/server/docs/mobile-referenced-db-tables.md` pero sí existen en `schema-original.txt` (es decir, eran preexistentes).

### Total preexistentes: 22

1. `c_accion_personal`
2. `c_cambio_guardia`
3. `c_empleado`
4. `c_empleado_plaza`
5. `c_horario`
6. `c_marca_dia`
7. `c_salida_anticipada`
8. `c_tipo_accion`
9. `e_estructura_articulo_corpo_puesto_entrega`
10. `e_estructura_articulo_corpo_puesto_plan`
11. `e_estructura_cliente`
12. `e_estructura_combo_articulo_cp`
13. `e_estructura_contrato`
14. `e_estructura_empresa`
15. `e_estructura_plazas`
16. `e_estructura_puesto`
17. `e_estructura_sucursal`
18. `n_articulo_corpo_puesto`
19. `n_division`
20. `n_ejecutivo_cuenta`
21. `pg_categoria_empleado`
22. `pg_categoria_salarial`
