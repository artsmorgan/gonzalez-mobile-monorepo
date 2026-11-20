# Datos obtenidos en consultas `find*` de Prisma

Para cada una de las siguientes 27 tablas, se revisaron todas las llamadas `prisma.<tabla>.find(...)`, `.findMany(...)`, `.findUnique(...)` y `.findFirst(...)` (incluyendo `findUniqueOrThrow`/`findFirstOrThrow`) dentro de `apps/server/app/api/` y `apps/server/utils/` (incluyendo `apps/server/utils/reports-functions/`).

Regla aplicada: si **al menos una** de las consultas encontradas para una tabla no usa `select` (ni `include` con `select`), esa consulta devuelve **todas las propiedades del modelo**, por lo que el resultado reportado para la tabla completa es la lista total de campos del modelo (extraída de `apps/server/app/prisma/schema.prisma`). Solo cuando **todas** las consultas encontradas usan `select` explícito se reporta la unión de los campos efectivamente seleccionados.

---

## `c_accion_personal`

**Consultada en:** `traslado-plaza/route.ts`, `traslado-plaza/[id]/upload-file/route.ts`, `utils/createAccionPersonal.ts`, `utils/reports-functions/accionesPersonalesReport.ts` (esta última con `include` sin `select`).

**Resultado: todas las propiedades del modelo.**

id, empleado_id, plaza_id, puesto_id, corpo_id, contrato_id, cliente_id, empresa_id, horario_id, consecutivo, fecha_inicio, fecha_fin, fecha_fin_traslado, fecha_insercion, usuario_insercion, salario, motivo_reversion, fecha_reversion, usuario_reversion, comentarios, document, fecha_actualizacion, tipoAccion_id, reemplazo_id, cantidad_horas, llegada_tardia_id, salida_anticipada_id, baja_id, ajuste_salario_id, vacacion_pago_id, vacacion_disfrute_id, contratacion_id, ausencia_id, permiso_sin_goce_id, permiso_con_goce_id, suspension_id, incapacidad_ins_id, traslado_id, reversible, preaviso_id, incapacidad_ccss_id, licencia_id, salario_base_mensual, numero_hed, numero_hem, numero_hen, monto_descontar_turnos, periodoPago_id, categoriaEmpleado_id, salario_base_diario, traslado_temp_id, fecha_vence_subir_adjunto, usuario_actualizacion, fecha_vence_justificar_ausencia, estado_aprobacion, fecha_aprobado_ec, usuario_aprueba_ec, fecha_aprobado_jo, usuario_aprueba_jo, operacion, vacacionMes_id, separacion_temp_id, cambio_horario_id, aceptar_restricciones_reversion, accionGeneraSeparacion_id, ausencia_transformada, tipoContratacion_id, cambio_periodo_pago_id, coordinador_id, coordinadoPor_id, fecha_sobrepuesto, adenda_id, libre_cubre_vacasiones_id, mobile_upload (más las relaciones declaradas en el modelo: c_incapacidad_ins, c_licencia, e_estructura_sucursal, c_cambio_horario, c_accion_personal, other_c_accion_personal, c_tipo_accion, c_horario, c_permiso_sin_goce, e_estructura_puesto, e_estructura_empresa, c_suspension, c_ausencia, c_empleado (x2 relaciones), c_adendas, c_contratacion, c_libre_cubre_vacasiones, e_estructura_contrato, n_coordinado_por, c_preaviso, c_baja, c_separacion_temp, c_ajuste_salario, c_traslado, c_vacacion_pago, n_tipo_contratacion, v_vacacion_mes, c_cambio_periodo_pago, p_periodopago_config, e_estructura_cliente, c_salida_anticipada, c_llegada_tardia, n_coordinador, c_incapacidad_ccss, c_traslado_temp, c_permiso_con_goce, pg_categoria_empleado, c_vacacion_disfrute, e_estructura_plazas, c_accion_personal_linea, c_cambio_guardia, c_marca_dia, e_empleado_incumplimiento, e_empleado_incumplimiento_accion, log_accionpersonal, log_accionpersonal_enlazada, pg_planilla_empleado (x2 relaciones), v_vacacion_solicitud).

---

## `c_cambio_guardia`

**Consultada en:** `mutuos-acuerdos/[id]/firma-ejecutivo/route.ts` (único sitio, `findUnique` sin `select`).

**Resultado: todas las propiedades del modelo.**

id, coordinador_id, fecha_reemplaza, turno_reemplaza, fecha_ausente, turno_ausente, motivo_ausente, descripcion, document, updated_at, empleadoReemplaza_id, plazaReemplaza_id, marcaDiaReemplaza_id, empleadoAusente_id, plazaAusente_id, marcaDiaAusente_id, accionPersonal_id, tipo, fecha_insercion, usuario_insercion, fecha_actualizacion, usuario_actualizacion, fecha_reversion, usuario_reversion, motivo_reversion, coordinadoPor_id, consecutivo, motivo_ausencia_empleado_ausente, motivo_ausencia_empleado_reemplaza, mobile_upload (más relaciones: c_marca_dia (x2), c_accion_personal, e_estructura_plazas (x2), c_empleado (x2), n_coordinado_por, n_coordinador, log_cambioguardia).

---

## `c_configuracion`

**Consultada en:** `utils/getTiempoGraciaMarcarSalida.ts` (único sitio, `findFirst` sin `select`).

**Resultado: todas las propiedades del modelo.**

id, tiempo_subir_adjunto_acciones, tiempo_justificar_ausencia, max_horas_xsem_semanales, max_horas_xmes_semanales, max_horas_xsem_quincenales, max_horas_xmes_quincenales, llegada_tardia_minimo, llegada_tardia_maximo, dias_gracia_fin_contrato, dias_gracia_portacion, habilitar_triple_validacion_tipo_contratacion, tiempo_gracia_marcar_salida.

---

## `c_empleado`

**Consultada en 92 archivos** de `app/api/` (p. ej. `auth/login/route.ts`, `empleados/[id]/route.ts`, `attendance/[id]/route.ts`, `puestos/corpo/[id]/route.ts`, `permit-request/route.ts`, entre muchos otros) y en `utils/` (p. ej. `createAccionPersonal.ts`, `createLoginMarca.ts`, `nomenclatorsSuperAdmins.ts`, `isSuperAdminEmpleado.ts`, y numerosas funciones de `utils/reports-functions/`).

**Resultado: todas las propiedades del modelo** (confirmado, entre otros, en `auth/login/route.ts` con `findFirst({ where: { cedula } })` sin `select`).

id, banco_id, supervisor_id, nacionalidad_id, nombre, segundo_apellido, primer_apellido, cedula, foto, salario, talla_calzado, talla_pantalon, talla_camisa, peso, estatura, Email, telefono, tipoCedula, fechaVencimientoCedula, fechaNacimiento, cantidad_deuda, otro_ingreso, tipoPagoCasa_id, estadoCivil_id, domicilio, sindicato_id, codigo, disponible_monitoreo, fecha_contratacion, numero_seguro_social, sexo, talla_camiseta, talla_jacket, telefono_otro, celular, pensionado, numero_hijos, banco_nro_cuenta, fecha_psicologico_vence, fecha_portacion_vence, periodoPago_id, seguroCaja_id, educacionPrimaria_id, educacionSecundaria_id, educacionUniversidad_id, educacionTecnico_id, tipoContratacion_id, escolaridad_id, estado, solicitud_id, es_comodin, comboUniforme_id, categoriaEmpleado_id, plazaEmpleado_id, duracion_del_contrato, fecha_fin_contrato, carrera_estudiada, latitude, longitude, password_expires_at, password, locked, codigo_verificacion, last_checked_update, firma_manual, ingresado (más ~70 relaciones declaradas en el modelo, entre ellas: a_recovery_password_token, c_accion_personal (x2), c_adendas, c_bitacora_acciones_empleado, c_bonificaciones, c_cambio_guardia (x2), c_contribucion_incidente, c_curso_empleado, c_deudas, n_educacion_tecnico, n_ejecutivo_cuenta, c_solicitud_empleo, n_escolaridad, n_estado_civil, n_educacion_universidad, n_educacion_primaria, c_empleado_plaza (x2), n_seguro_caja, n_sindicato, n_educacion_secundaria, c_combo_uniforme_plaza, n_nacionalidad, n_tipo_contratacion, n_banco, p_periodopago_config, pg_categoria_empleado, n_tipo_pago_casa, c_empleado_almuerzo, c_empleado_basedatos_digital, c_empleado_datos_adjuntos_rrhh, c_empleado_gasto_principal, c_empleado_notification, c_empleado_referencias, c_empleado_registro_laboral, c_empleado_sindicato, c_empleado_tramite_portacion_arma, c_encuesta_cliente, c_extra_limite_semanal, c_fecha_excepcional, c_horas_extras (x2), c_induccion, c_inducciones (x2), c_intercambio_linea (x2), c_marca_dia (x4), c_salida_anticipada, c_separacion_temp, c_solicitud_permiso, d_empleado_cartas_recomendacion, d_empleado_hoja_delincuencia, d_empleado_otras_anotaciones, e_antecedente_penal, e_articulo_uniforme_empleado, e_capacitacion_empleado, e_cuenta_banco_empleado, e_cursos, e_dato_legal, e_domicilio, e_educacion, e_educacion_idiomas, e_empleado_incumplimiento, e_empleado_lista_negra, e_empleado_visualizacion_manual_puesto, e_estructura_empleado_autorizado_contrato, e_familia, e_historia_salud, e_historia_trabajo, e_licencia, e_persona_dependen, e_referencia_personal, e_registro_enfermedades, e_registro_habilidades, e_registro_personas, e_registro_vehiculos, e_requerimiento_cumplido, e_trabajo, log_accionpersonal, log_cambioguardia (x2), log_extra, m_comodin_ausente, m_puesto_no_cubierto, m_refuerzo, m_reposicion_de_horas, n_apoderado, p_planillas_empleado, pg_planilla_empleado, pg_planilla_extra_empleado, refresh_token, s_empleado, s_planilla_empleado, v_planilla_aguinaldo_empleado, v_salario_mes, v_vacacion_empleado, v_vacacion_solicitud (x2)).

---

## `c_empleado_datos_adjuntos_rrhh`

**Consultada en:** `main-structure/mainStructureQueries.ts` (único sitio, con `select` explícito).

**Resultado: unión de campos seleccionados.**

empleado_id, fecha, tipoDatoAdjunto_id.

---

## `c_empleado_plaza`

**Consultada en:** `puestos/corpo/[id]/route.ts`, `permit-request/route.ts`, `permit-request/plazas/route.ts`, `empleados/corpo/[id]/route.ts`, `check-permissions/route.ts`, `auth/login/route.ts`, `main-structure/mainStructureQueries.ts`, `utils/createAccionPersonal.ts`.

**Resultado: todas las propiedades del modelo** (varias llamadas sin `select`, p. ej. `auth/login/route.ts`, `createAccionPersonal.ts`, `empleados/corpo/[id]/route.ts`; algunas otras sí usan `select`, pero basta una sin restricción).

id, empleado_id, plaza_id, puesto_id, corpo_id, contrato_id, cliente_id, empresa_id, horario_id, salario, division_id, ejecutivoCuenta_id (más relaciones: c_empleado (x2), e_estructura_sucursal, n_division, c_horario, e_estructura_puesto, e_estructura_empresa, n_ejecutivo_cuenta, e_estructura_contrato, e_estructura_cliente, e_estructura_plazas (x2)).

---

## `c_horario`

**Consultada en:** `lunch-time/horario/[id]/minutos-almuerzo/route.ts`, `lunch-time/[id]/route.ts`, `attendance/user/[id]/route.ts` (las 3 son `findUnique` sin `select`).

**Resultado: todas las propiedades del modelo.**

id, titulo, fecha_activacion, deleted_at, activo, tiene_almuerzo, minutos_almuerzo, tipo_contrato, tipo_rotacion, inactivated_at, jornada_acumulativa, fecha_insercion, usuario_insercion, fecha_actualizacion, usuario_actualizacion, fecha_reversion, usuario_reversion, inactivated_by, jornada_reducida (más relaciones: c_accion_personal, c_cambio_horario (x2), c_empleado_plaza, c_fecha_excepcional, c_horario_dia, c_marca_dia, e_estructura_horario_plaza_historial, e_estructura_plazas, log_horario, log_horario_dia, pg_planilla_empleado).

---

## `c_marca_dia`

**Consultada en 66 archivos** de `app/api/` (p. ej. `attendance/[id]/route.ts`, `attendance-control/route.ts`, `permit-request/route.ts`, `mutuos-acuerdos/route.ts`, entre muchos otros) y en `utils/` (`sendNotification.ts`, `getPermitTurnosFromPlanillasRange.ts`, `createAccionPersonal.ts`, `getUserMarca.ts`, `createActivities.ts`, `reports-functions/mutuosAcuerdosReport.ts`).

**Resultado: todas las propiedades del modelo** (confirmado en múltiples `findMany`/`findUnique` sin `select`, p. ej. varias llamadas en `attendance/[id]/route.ts`).

id, plaza_id, puesto_id, corpo_id, contrato_id, cliente_id, empresa_id, horario_id, fecha, hora_inicio, hora_fin, horas_duracion, tipo_turno, hora_entrada, hora_entrada_digitada, hora_salida, motivo_ausente, tipo_comida, observaciones, empleadoFijo_id, motivoExtra_id, empleadoReemplaza_id, accionPersonal_id, motivoErrorAsignacion_id, hora_salida_digitada, empleadoReemplaza2_id, marcaComoReemplazo_id, hora_inicio_plan, hora_fin_plan, tipo_turno_plan, is_dia_excepcion, operacion_extra, operacion_accion, is_puesto_no_cubierto, is_reposicion_de_horas, motivo_cdg, empleadoCDG_id, marcaCdgHacia_id, coordinador_id, motivoMarcarHorarioPlaza_id, motivo_separacion_temp, hora_mas_cuatro, hora_mas_cuatro_entrada, hora_mas_cuatro_digitada, usuario_marca_entrada, usuario_marca_salida, hora_salida_anticipada, teorico, motivo_induccion, marcaEnInduccion_id, marcaComoReemplazo2_id, is_cubierto_como_comodin, usuarioMarcaEntrada (más relaciones: c_cambio_guardia (x2), c_horas_extras, c_induccion_dia, c_inducciones (x2), n_motivo_marcar_horario_plaza, c_marca_dia (varias auto-relaciones), e_estructura_sucursal, c_empleado (x4), c_accion_personal, c_horario, e_estructura_puesto, e_estructura_empresa, e_estructura_contrato, n_motivo_extra, e_estructura_cliente, n_coordinador, e_estructura_plazas, n_motivo_error_asignacion, e_estructura_dia_excepcion_plaza, m_comodin_ausente, m_operacion, m_puesto_no_cubierto, m_refuerzo, m_reposicion_de_horas, pg_pe_dia).

---

## `c_tipo_accion`

**Consultada en:** `traslado-plaza/route.ts` (único sitio, `findUnique` sin `select`).

**Resultado: todas las propiedades del modelo.**

id, nombre, codigo, clase, afecta_salario, afecta_vacaciones, afecta_horario (más relaciones: c_accion_personal, c_roltipoaccion_tipoaccion, log_accionpersonal).

---

## `e_estructura_articulo_corpo_puesto_entrega`

**Consultada en:** `articulo-mantenimiento/puesto/[id]/route.ts`, `articulo-mantenimiento/asignado/[id]/movimientos/route.ts` y `[movId]/route.ts`, `main-structure/mainStructureQueries.ts`, `entrega-puestos/route.ts`, `mantenimiento-equipo/route.ts`, `mantenimiento-equipo/bulk-articulos/route.ts`, `utils/createActivities.ts`, `utils/createReporteArticuloMantenimiento.ts`, `utils/reports-functions/articulosPuestoBatchData.ts`.

**Resultado: todas las propiedades del modelo** (confirmado en `mainStructureQueries.ts`, sin `select`).

id, corpo_id, puesto_id, marca, serie, modelo, fechaEntrega, nomencladorArticuloCP_id (más relaciones: c_articulo_mantenimiento, c_movimientos_articulo_mantenimiento, e_estructura_sucursal, e_estructura_puesto, n_articulo_corpo_puesto).

---

## `e_estructura_articulo_corpo_puesto_plan`

**Consultada en:** `mantenimiento-equipo/route.ts`, `mantenimiento-equipo/bulk-articulos/route.ts`, `main-structure/mainStructureQueries.ts`, `entrega-puestos/route.ts`, `articulo-mantenimiento/puesto/[id]/route.ts`, `articulo-mantenimiento/plan/[id]/movimientos/route.ts` y `[movId]/route.ts`, `utils/createActivities.ts`, `utils/createReporteArticuloMantenimiento.ts`, `utils/reports-functions/articulosPuestoBatchData.ts`.

**Resultado: todas las propiedades del modelo** (confirmado en `mainStructureQueries.ts`, sin `select`).

id, corpo_id, puesto_id, cantidad, articuloCP_id, combo_id (más relaciones: c_articulo_mantenimiento, c_movimientos_articulo_mantenimiento, e_estructura_sucursal, e_estructura_puesto, e_estructura_combo_articulo_cp, n_articulo_corpo_puesto).

---

## `e_estructura_cliente`

**Consultada en más de 55 archivos** de `app/api/` (p. ej. `agenda-minuta/route.ts`, `incidents/route.ts`, `entrega-puestos/route.ts`, `mutuos-acuerdos/route.ts`, entre muchos otros) y en la gran mayoría de `utils/reports-functions/*.ts`.

**Resultado: todas las propiedades del modelo** (confirmado en `mainStructureQueries.ts` y en numerosos `findUnique({ where: { id } })` sin `select`, p. ej. `training/route.ts`).

id, empresa_id, nombre, deleted, fecha_insercion, usuario_insercion, fecha_actualizacion, usuario_actualizacion, fecha_inactivacion, usuario_inactivacion (más relaciones: a_recibo_pago, c_accion_personal, c_agenda_minuta, c_apertura_cierre_puesto, c_boleta_apreciacion_vulnerabilidad, c_checklist_supervision, c_empleado_plaza, c_encuesta_cliente, c_incidente, c_marca_dia, c_notas_voz, c_producto_no_conforme, c_registro_induccion_general, c_vehiculos_corporativos, e_control_documento_entregado_cliente, e_empleado_lista_negra, e_estructura_empresa, e_estructura_cliente_usuario, e_estructura_contrato, e_llave, e_llavero, e_mutuos_acuerdos, e_registro_capacitaciones, e_registro_entrega_puesto, e_registro_personas, e_registro_vehiculos).

---

## `e_estructura_combo_articulo_cp`

**Consultada en:** `articulo-mantenimiento/puesto/[id]/route.ts`, `entrega-puestos/route.ts`, `mantenimiento-equipo/route.ts`, `main-structure/mainStructureQueries.ts`, `utils/createActivities.ts`, `utils/reports-functions/articulosPuestoBatchData.ts`.

**Resultado: todas las propiedades del modelo** (confirmado en `mainStructureQueries.ts`, sin `select`).

id, nombre, descripcion (más relaciones: e_estructura_articulo_corpo_puesto_plan, e_estructura_puesto, e_estructura_sucursal).

---

## `e_estructura_contrato`

**Consultada en más de 45 archivos** de `app/api/` (p. ej. `opening-closing-position/route.ts`, `mutuos-acuerdos/route.ts`, `permit-request/route.ts`, entre otros) y en la gran mayoría de `utils/reports-functions/*.ts`, además de `utils/getCoordinadoPorId.ts`, `utils/hydratePreexistentIncludes.ts`, `utils/registroCorpoPuesto.ts`.

**Resultado: todas las propiedades del modelo** (confirmado en `mainStructureQueries.ts` y varios `findUnique` sin `select`).

id, cliente_id, empresa_id, nombre, nro_contrato, activo, nro_cartel, fecha_inicio, fecha_fin, vigencia, prorroga, tipoContrato_id, lugarApertura_id, division_id, document, updated_at, cantidad_corpos, deleted, fecha_insercion, usuario_insercion, fecha_actualizacion, usuario_actualizacion, fecha_inactivacion, usuario_inactivacion (más relaciones: c_accion_personal, c_bonificacion_turno, c_empleado_plaza, c_marca_dia, n_division, n_tipo_contrato, e_estructura_empresa, n_lugar_apertura, e_estructura_cliente, e_estructura_curso_contrato, e_estructura_empleado_autorizado_contrato, e_estructura_historico_contrato, e_estructura_requerimiento_contrato, e_estructura_sucursal, m_rol_monitoreo_contrato, pg_planilla_empleado).

---

## `e_estructura_empresa`

**Consultada en más de 40 archivos** de `app/api/` (p. ej. `auth/[id]/current-company/route.ts`, `training/route.ts`, `opening-closing-position/route.ts`, entre otros) y en la gran mayoría de `utils/reports-functions/*.ts`.

**Resultado: todas las propiedades del modelo** (confirmado en `mainStructureQueries.ts` y varios `findUnique` sin `select`, p. ej. `training/route.ts`).

id, nombre, numero_patronal, tipo_patrono, cedula_juridica, segregado, sector, codigo_sucursal_ccss, deleted, document, updated_at, codigo, numero_cuenta_banco, fecha_insercion, usuario_insercion, fecha_actualizacion, usuario_actualizacion, fecha_inactivacion, usuario_inactivacion, numero_cliente, correo, telefono, plan_banco_bac, b_consecutivo_empresa_banco (más relaciones: c_accion_personal, c_empleado_plaza, c_encuesta_cliente, c_incapacidad_ins, c_incidente, c_marca_dia, c_notas_voz, c_registro_induccion_general, e_estructura_cliente, e_estructura_contrato, e_registro_capacitaciones, n_empresa_banco, n_empresa_poliza, pg_planilla_extra, pg_planilla_extra_empleado, s_planilla, v_planilla_aguinaldo).

---

## `e_estructura_plazas`

**Consultada en:** `activities/marca/[id]/route.ts`, `empleados/corpo/[id]/route.ts`, `mutuos-acuerdos/route.ts`, `main-structure/mainStructureQueries.ts`, `puestos/[id]/ubicacion/route.ts`, `puestos/[id]/notas/route.ts` y `[id-nota]/route.ts`, `auth/login/route.ts`, `check-permissions/route.ts`, `puestos/corpo/[id]/route.ts`, `attendance/user/[id]/route.ts` y `next/route.ts`, `permit-request/*`, `evaluation/route.ts`, `job-manuals/route.ts`, `induction-tour-record/route.ts`, `notification/plaza/[id]/route.ts`, `utils/createAccionPersonal.ts`, `utils/sendNotification.ts`, `utils/getCoordinadoPorId.ts`, `utils/reports-functions/maestroQuejasReport.ts`, `mutuosAcuerdosReport.ts`, `induccionRecorridoReport.ts`.

**Resultado: todas las propiedades del modelo** (confirmado en `mainStructureQueries.ts` y `utils/sendNotification.ts`, sin `select`).

id, puesto_id, rol_id, nombre, nro_plaza, codigo_plaza, comboUniforme_id, categoriaSalarial_id, fecha_inicio, renov_unif, monitoreo, fecha_fin, deleted, tipo_contratacion, estado, orden, hora_inicio, fecha_insercion, usuario_insercion, fecha_actualizacion, usuario_actualizacion, fecha_inactivacion, usuario_inactivacion, empleadoPlaza_id, maestra, peso, es_real (más relaciones: c_accion_personal, c_cambio_guardia (x2), c_empleado_plaza (x2), c_evaluacion_empleado, c_horario_dia, c_horas_extras, c_induccion_dia, c_inducciones (x2), c_intercambio_linea (x2), c_marca_dia, c_plaza_notification, c_solicitud_empleo, c_traslado, c_traslado_temp, e_actividades_puesto_plaza, e_estructura_bonificaciones_plaza, e_estructura_dia_excepcion_plaza, e_estructura_horario_plaza_historial, c_horario, e_estructura_puesto, c_combo_uniforme_plaza, pg_categoria_salarial, log_accionpersonal, log_cambioguardia (x2), log_extra, m_puesto_no_cubierto, m_refuerzo, pg_planilla_empleado, pg_planilla_extra_empleado, s_empleado_plaza, v_vacacion_solicitud).

---

## `e_estructura_puesto`

**Consultada en más de 85 archivos** de `app/api/` (prácticamente toda la carpeta de rutas relacionadas a puestos, actividades, artículos, mantenimiento, encuestas, permisos, etc.) y en la gran mayoría de `utils/reports-functions/*.ts`.

**Resultado: todas las propiedades del modelo** (confirmado en `mainStructureQueries.ts` y numerosos `findUnique` sin `select`).

id, sucursal_id, nombre, tipoHoraExtra_id, cantidad_plazas, tipoPuesto_id, deleted, codigo, tiene_relevo, comboArticulosCP_id, orden, horarioPuesto_id, fecha_insercion, usuario_insercion, fecha_actualizacion, usuario_actualizacion, fecha_inactivacion, usuario_inactivacion, es_cubrevacaciones, coordenadas_gpslat, coordenadas_gpslng (más relaciones: c_accion_personal, c_agenda_minuta, c_apertura_cierre_puesto, c_boleta_apreciacion_vulnerabilidad, c_checklist_supervision, c_empleado_plaza, c_encuesta_cliente, c_evaluacion_empleado, c_induccion, c_marca_dia, c_puesto_notas, e_actividades_puesto, e_capacitacion_puesto, e_estructura_articulo_corpo_puesto_entrega, e_estructura_articulo_corpo_puesto_plan, e_estructura_dia_excepcion_puesto, e_estructura_plazas, e_estructura_sucursal, n_tipo_puesto, e_estructura_combo_articulo_cp, e_estructura_horariopuesto, n_horas_extras, e_llave, e_llavero, e_puestos_manual_puesto, e_registro_entrega_puesto, e_registro_personas, e_registro_vehiculos, m_reposicion_de_horas).

---

## `e_estructura_sucursal`

**Consultada en más de 75 archivos** de `app/api/` (p. ej. `corporate-vehicles/*`, `attendance-control/*`, `checklist-supervision/*`, entre muchos otros) y en la gran mayoría de `utils/reports-functions/*.ts`.

**Resultado: todas las propiedades del modelo** (confirmado en `mainStructureQueries.ts` y numerosos `findUnique` sin `select`).

id, nombre, contrato_id, nro_sucursal, provincia_id, canton_id, distrito_id, ejecutivoCuenta_id, region_id, direccion, coordenadas_gpslat, coordenadas_gpslng, cantidad_puestos, deleted, comboArticulosCP_id, orden, permite_extras_induccion, fecha_insercion, usuario_insercion, fecha_actualizacion, usuario_actualizacion, fecha_inactivacion, usuario_inactivacion (más relaciones: c_accion_personal, c_agenda_minuta, c_apertura_cierre_puesto, c_boleta_apreciacion_vulnerabilidad, c_checklist_supervision, c_empleado_plaza, c_encuesta_cliente, c_evaluacion_empleado, c_extra_tarifa_corpo, c_incidente, c_marca_dia, c_notas_voz, c_producto_no_conforme, c_registro_induccion_general, c_vehiculos_corporativos, e_control_documento_entregado_cliente, e_empleado_lista_negra, e_estructura_articulo_corpo_puesto_entrega, e_estructura_articulo_corpo_puesto_plan, e_estructura_puesto, n_provincia, n_ejecutivo_cuenta, e_estructura_contrato, e_estructura_combo_articulo_cp, n_canton, n_region, n_distrito, e_llave, e_llavero, e_mutuos_acuerdos, e_registro_capacitaciones, e_registro_entrega_puesto, e_registro_personas, e_registro_vehiculos, m_refuerzo, m_rol_monitoreo_sucursal, pg_planilla_empleado).

---

## `e_licencia`

**Consultada en:** `main-structure/mainStructureQueries.ts` (único sitio, con `select` explícito).

**Resultado: unión de campos seleccionados.**

empleado_id, tipoLicencia_id, vence.

---

## `n_articulo_corpo_puesto`

**Consultada en:** `activities/marca/[id]/route.ts`, `articulos/route.ts`, `mantenimiento-equipo/plantilla/get-file/route.ts`, `mantenimiento-equipo/bulk-articulos/route.ts`, `mantenimiento-equipo/articulos-catalogo/route.ts`, `main-structure/mainStructureQueries.ts`, `entrega-puestos/route.ts`, `utils/createActivities.ts`, `utils/reports-functions/articulosPuestoBatchData.ts`, `utils/reports-functions/mantenimientoArticulosReport.ts`.

**Resultado: todas las propiedades del modelo** (p. ej. `activities/marca/[id]/route.ts` y `articulos/route.ts`, ambos sin argumentos).

id, nombre (más relaciones: e_estructura_articulo_corpo_puesto_entrega, e_estructura_articulo_corpo_puesto_plan, n_tipo_mantenimiento_articulo).

---

## `n_coordinador`

**Consultada en:** `utils/nomenclatorsEjecutivoCoordinador.ts` (único sitio, `findMany({ where, orderBy })` sin `select`).

**Resultado: todas las propiedades del modelo.**

id, nombre, coordinadoPor_id, activo (más relaciones: c_accion_personal, c_cambio_guardia, c_horas_extras, c_inducciones, c_marca_dia, n_coordinado_por, security_fos_user, v_vacacion_solicitud).

---

## `n_division`

**Consultada en más de 35 archivos**, incluyendo `check-permissions/route.ts`, `encuesta-nps/*`, `auth/login/route.ts`, `main-structure/mainStructureQueries.ts`, `reportes/create.ts`, `general-induction-register/route.ts`, `utils/getCoordinadoPorId.ts`, `utils/getRoleDivision.ts`, `utils/hydratePreexistentIncludes.ts` y la gran mayoría de `utils/reports-functions/*.ts`.

**Resultado: todas las propiedades del modelo** (p. ej. `check-permissions/route.ts`, `auth/login/route.ts`, `mainStructureQueries.ts`, sin `select`).

id, nombre, codigo (más relaciones: c_apertura_cierre_puesto, c_empleado_plaza, c_encuesta_cliente, c_solicitud_empleo, e_estructura_contrato, n_empresa_poliza, security_fos_users_divisiones).

---

## `n_ejecutivo_cuenta`

**Consultada en:** `reportes/create.ts`, `executives/route.ts`, `utils/nomenclatorsEjecutivoCoordinador.ts`, `utils/nomenclatorsEmpleadoEjecutivo.ts`, `utils/reports-functions/checklistSupervisionReport.ts`, `mutuosAcuerdosReport.ts`, `solicitudesPermisoReport.ts`.

**Resultado: todas las propiedades del modelo** (p. ej. `executives/route.ts` `findMany()` sin argumentos).

id, nombre (más relaciones: c_empleado, c_empleado_plaza, c_incidente, e_estructura_sucursal, e_mutuos_acuerdos, security_fos_user).

---

## `n_tipo_dato_adjunto_rrhh`

**Consultada en:** `main-structure/mainStructureQueries.ts` (único sitio, con `select` explícito).

**Resultado: unión de campos seleccionados.**

id, nombre.

---

## `n_tipo_licencia`

**Consultada en:** `main-structure/mainStructureQueries.ts` (único sitio, con `select` explícito).

**Resultado: unión de campos seleccionados.**

id, nombre.

---

## `pg_categoria_empleado`

**Consultada en:** `check-permissions/route.ts`, `auth/login/route.ts`, `utils/getCoordinadoPorId.ts`, `utils/getRoleDivision.ts`, `utils/sendNotification.ts`.

**Resultado: todas las propiedades del modelo** (p. ej. `check-permissions/route.ts` `findUnique({ where: { id } })` sin `select`).

id, codigo, nombre, salario_base_turno_semanal, salario_base_turno_extra_semanal, salario_base_mensual (más relaciones: c_accion_personal, c_bonificacion_turno, c_empleado, c_horas_extras, pg_categoria_salarial, pg_categoria_salarial_log, pg_pago_turno_semanal, pg_pago_turno_semanal_log, s_empleado).

---

## `pg_categoria_salarial`

**Consultada en:** `check-permissions/route.ts`, `auth/login/route.ts`, `utils/createAccionPersonal.ts`, `utils/getCoordinadoPorId.ts`, `utils/getRoleDivision.ts`, `utils/sendNotification.ts`.

**Resultado: todas las propiedades del modelo** (p. ej. `check-permissions/route.ts` `findUnique({ where: { id } })` sin `select`).

id, nombre, clasificacion, salario_mes, salario_dia, codigo_ocupacion, salario_base_mes, horas_extras_diurnas, horas_extras_mixtas, horas_extras_nocturnas, categoriaEmpleado_id, periodo_pago, fecha_inicio, salario_base_extras_mes, is_basado_dias (más relaciones: c_cambio_horario (x2), e_estructura_plazas, n_pago_turno, pg_categoria_empleado, pg_categoria_salarial_log, pg_turno_excepcion).

---

## Notas

- Todas las llamadas revisadas usan Prisma directo (`prisma.<tabla>.find...(`), incluyendo las de `utils/reports-functions/`, donde `prisma` suele ser un parámetro tipado `ReportDataAccess` pero con la misma sintaxis literal.
- Para 22 de las 27 tablas, basta **una sola consulta sin `select`/`include`** en cualquier parte del código (muy frecuentemente en `apps/server/app/api/main-structure/mainStructureQueries.ts`) para que el resultado se marque como "todas las propiedades del modelo", **independientemente** de que otras rutas sí limiten los campos con `select` en sus propias consultas.
- Solo 5 tablas (`c_empleado_datos_adjuntos_rrhh`, `e_licencia`, `n_tipo_dato_adjunto_rrhh`, `n_tipo_licencia`, y ninguna otra) tienen **todas** sus consultas restringidas por `select`, y en los cuatro casos la única consulta encontrada está en `apps/server/app/api/main-structure/mainStructureQueries.ts`.
- Los campos de cada modelo fueron extraídos directamente de `apps/server/app/prisma/schema.prisma`; las relaciones marcadas "(x2)"/"(x4)" indican que el modelo declara varias relaciones distintas hacia/desde esa misma tabla (típicamente con nombres de relación explícitos, p. ej. `c_empleado_c_accion_personal_reemplazo_idToc_empleado`).
