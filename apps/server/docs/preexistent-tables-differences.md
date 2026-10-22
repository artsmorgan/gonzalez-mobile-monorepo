# Campos y relaciones nuevos en tablas preexistentes

Este documento lista las **líneas nuevas** (campos/relaciones) añadidas en los modelos preexistentes, comparando `schema-modificado.txt` contra `schema-original.txt`, para las tablas listadas como preexistentes en `schema-modificado-modelos-nuevos-filtrados.md`.

## Total de tablas analizadas: 22

## Tablas con campos/relaciones nuevos: 15

## 1. `c_accion_personal`

### Líneas nuevas (1)

- `mobile_upload                                         Boolean?`

## 2. `c_cambio_guardia`

### Líneas nuevas (1)

- `mobile_upload                      Boolean?`

## 3. `c_empleado`

### Líneas nuevas (15)

- `firma_manual                                                 String?                                  @db.LongText`
- `ingresado                                                    Boolean                                  @default(false)`
- `a_recovery_password_token                                    a_recovery_password_token[]`
- `c_contribucion_incidente                                     c_contribucion_incidente[]`
- `c_empleado_almuerzo                                          c_empleado_almuerzo[]`
- `c_empleado_notification                                      c_empleado_notification[]`
- `c_encuesta_cliente                                           c_encuesta_cliente[]`
- `c_puesto_notas_bitacora_cambios                              c_puesto_notas_bitacora_cambios[]`
- `c_salida_anticipada                                          c_salida_anticipada[]`
- `c_solicitud_permiso                                          c_solicitud_permiso[]`
- `e_capacitacion_empleado                                      e_capacitacion_empleado[]`
- `e_empleado_visualizacion_manual_puesto                       e_empleado_visualizacion_manual_puesto[]`
- `e_registro_personas                                          e_registro_personas[]`
- `e_registro_vehiculos                                         e_registro_vehiculos[]`
- `refresh_token                                                refresh_token[]`

## 4. `c_marca_dia`

### Líneas nuevas (2)

- `usuarioMarcaEntrada                                               String?`
- `salida_anticipada_id                                              Int?`

## 5. `c_salida_anticipada`

### Líneas nuevas (4)

- `empleado_id            Int?`
- `motivo                 String?            @db.LongText`
- `c_empleado             c_empleado?        @relation(fields: [empleado_id], references: [id], onDelete: Cascade)`
- `@@index([empleado_id], map: "c_salida_anticipada_empleado_id_fkey")`

## 6. `e_estructura_articulo_corpo_puesto_entrega`

### Líneas nuevas (2)

- `c_articulo_mantenimiento             c_articulo_mantenimiento[]`
- `c_movimientos_articulo_mantenimiento c_movimientos_articulo_mantenimiento[]`

## 7. `e_estructura_articulo_corpo_puesto_plan`

### Líneas nuevas (2)

- `c_articulo_mantenimiento             c_articulo_mantenimiento[]`
- `c_movimientos_articulo_mantenimiento c_movimientos_articulo_mantenimiento[]`

## 8. `e_estructura_cliente`

### Líneas nuevas (18)

- `c_agenda_minuta                       c_agenda_minuta[]`
- `c_apertura_cierre_puesto              c_apertura_cierre_puesto[]`
- `c_boleta_apreciacion_vulnerabilidad   c_boleta_apreciacion_vulnerabilidad[]`
- `c_checklist_supervision               c_checklist_supervision[]`
- `c_encuesta_cliente                    c_encuesta_cliente[]`
- `c_incidente                           c_incidente[]`
- `c_notas_voz                           c_notas_voz[]`
- `c_producto_no_conforme                c_producto_no_conforme[]`
- `c_registro_induccion_general          c_registro_induccion_general[]`
- `c_vehiculos_corporativos              c_vehiculos_corporativos[]`
- `e_control_documento_entregado_cliente e_control_documento_entregado_cliente[]`
- `e_llave                               e_llave[]`
- `e_llavero                             e_llavero[]`
- `e_mutuos_acuerdos                     e_mutuos_acuerdos[]`
- `e_registro_capacitaciones             e_registro_capacitaciones[]`
- `e_registro_entrega_puesto             e_registro_entrega_puesto[]`
- `e_registro_personas                   e_registro_personas[]`
- `e_registro_vehiculos                  e_registro_vehiculos[]`

## 9. `e_estructura_empresa`

### Líneas nuevas (5)

- `c_encuesta_cliente           c_encuesta_cliente[]`
- `c_incidente                  c_incidente[]`
- `c_notas_voz                  c_notas_voz[]`
- `c_registro_induccion_general c_registro_induccion_general[]`
- `e_registro_capacitaciones    e_registro_capacitaciones[]`

## 10. `e_estructura_plazas`

### Líneas nuevas (3)

- `c_evaluacion_empleado   c_evaluacion_empleado[]`
- `c_plaza_notification    c_plaza_notification[]`
- `e_actividades_puesto_plaza e_actividades_puesto_plaza[]`

## 11. `e_estructura_puesto`

### Líneas nuevas (17)

- `coordenadas_gpslat                  String?                               @db.VarChar(255)`
- `coordenadas_gpslng                  String?                               @db.VarChar(255)`
- `c_agenda_minuta                     c_agenda_minuta[]`
- `c_apertura_cierre_puesto            c_apertura_cierre_puesto[]`
- `c_boleta_apreciacion_vulnerabilidad c_boleta_apreciacion_vulnerabilidad[]`
- `c_checklist_supervision             c_checklist_supervision[]`
- `c_encuesta_cliente                  c_encuesta_cliente[]`
- `c_evaluacion_empleado               c_evaluacion_empleado[]`
- `c_puesto_notas                      c_puesto_notas[]`
- `e_actividades_puesto                e_actividades_puesto[]`
- `e_capacitacion_puesto               e_capacitacion_puesto[]`
- `e_llave                             e_llave[]`
- `e_llavero                           e_llavero[]`
- `e_puestos_manual_puesto             e_puestos_manual_puesto[]`
- `e_registro_entrega_puesto           e_registro_entrega_puesto[]`
- `e_registro_personas                 e_registro_personas[]`
- `e_registro_vehiculos                e_registro_vehiculos[]`

## 12. `e_estructura_sucursal`

### Líneas nuevas (19)

- `c_agenda_minuta                       c_agenda_minuta[]`
- `c_apertura_cierre_puesto              c_apertura_cierre_puesto[]`
- `c_boleta_apreciacion_vulnerabilidad   c_boleta_apreciacion_vulnerabilidad[]`
- `c_checklist_supervision               c_checklist_supervision[]`
- `c_encuesta_cliente                    c_encuesta_cliente[]`
- `c_evaluacion_empleado                 c_evaluacion_empleado[]`
- `c_incidente                           c_incidente[]`
- `c_notas_voz                           c_notas_voz[]`
- `c_producto_no_conforme                c_producto_no_conforme[]`
- `c_registro_induccion_general          c_registro_induccion_general[]`
- `c_vehiculos_corporativos              c_vehiculos_corporativos[]`
- `e_control_documento_entregado_cliente e_control_documento_entregado_cliente[]`
- `e_llave                               e_llave[]`
- `e_llavero                             e_llavero[]`
- `e_mutuos_acuerdos                     e_mutuos_acuerdos[]`
- `e_registro_capacitaciones             e_registro_capacitaciones[]`
- `e_registro_entrega_puesto             e_registro_entrega_puesto[]`
- `e_registro_personas                   e_registro_personas[]`
- `e_registro_vehiculos                  e_registro_vehiculos[]`

## 13. `n_articulo_corpo_puesto`

### Líneas nuevas (1)

- `n_tipo_mantenimiento_articulo     n_tipo_mantenimiento_articulo[]`

## 14. `n_division`

### Líneas nuevas (2)

- `c_apertura_cierre_puesto c_apertura_cierre_puesto[]`
- `c_encuesta_cliente       c_encuesta_cliente[]`

## 15. `n_ejecutivo_cuenta`

### Líneas nuevas (2)

- `c_incidente       c_incidente[]`
- `e_mutuos_acuerdos e_mutuos_acuerdos[]`
