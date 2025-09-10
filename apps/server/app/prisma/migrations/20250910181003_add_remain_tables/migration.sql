/*
  Warnings:

  - You are about to drop the column `empleado_id` on the `c_horas_extras` table. All the data in the column will be lost.
  - You are about to alter the column `horas` on the `c_horas_extras` table. The data in that column could be lost. The data in that column will be cast from `Decimal(5,2)` to `Double`.
  - You are about to alter the column `descripcion` on the `c_horas_extras` table. The data in that column could be lost. The data in that column will be cast from `VarChar(254)` to `VarChar(191)`.
  - Added the required column `empleadoId` to the `c_horas_extras` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `a_recibo_pago` DROP FOREIGN KEY `FK_23679AA8DE734E51`;

-- DropForeignKey
ALTER TABLE `b_consecutivo_empresa_banco` DROP FOREIGN KEY `FK_E8669A36521E1991`;

-- DropForeignKey
ALTER TABLE `b_consecutivo_empresa_banco` DROP FOREIGN KEY `FK_E8669A36CC04A73E`;

-- DropForeignKey
ALTER TABLE `b_pago_excluido` DROP FOREIGN KEY `FK_E34A23BC952BE730`;

-- DropForeignKey
ALTER TABLE `c_adendas` DROP FOREIGN KEY `FK_C15A2329952BE730`;

-- DropForeignKey
ALTER TABLE `c_adendas` DROP FOREIGN KEY `FK_C15A2329A1C0A276`;

-- DropForeignKey
ALTER TABLE `c_articulo_uniforme_plaza` DROP FOREIGN KEY `FK_9F3A46B04591C704`;

-- DropForeignKey
ALTER TABLE `c_articulo_uniforme_plaza` DROP FOREIGN KEY `FK_9F3A46B0EB6587E3`;

-- DropForeignKey
ALTER TABLE `c_baja` DROP FOREIGN KEY `FK_F87CC83189D8089F`;

-- DropForeignKey
ALTER TABLE `c_baja__n_motivo_no_recontratable` DROP FOREIGN KEY `FK_4E7270C72DDF1AAA`;

-- DropForeignKey
ALTER TABLE `c_baja__n_motivo_no_recontratable` DROP FOREIGN KEY `FK_4E7270C73F43B690`;

-- DropForeignKey
ALTER TABLE `c_bonificacion_turno` DROP FOREIGN KEY `FK_1F8A4D4970AE7BF1`;

-- DropForeignKey
ALTER TABLE `c_bonificacion_turno` DROP FOREIGN KEY `FK_1F8A4D49ED33694C`;

-- DropForeignKey
ALTER TABLE `c_bonificaciones` DROP FOREIGN KEY `FK_3DBD73D9952BE730`;

-- DropForeignKey
ALTER TABLE `c_cambio_guardia` DROP FOREIGN KEY `FK_285F043360ACC8FA`;

-- DropForeignKey
ALTER TABLE `c_cambio_guardia` DROP FOREIGN KEY `FK_285F043375F636ED`;

-- DropForeignKey
ALTER TABLE `c_cambio_guardia` DROP FOREIGN KEY `FK_285F043381B56B3`;

-- DropForeignKey
ALTER TABLE `c_cambio_guardia` DROP FOREIGN KEY `FK_285F04339D7193A2`;

-- DropForeignKey
ALTER TABLE `c_cambio_guardia` DROP FOREIGN KEY `FK_285F0433C2F7DD75`;

-- DropForeignKey
ALTER TABLE `c_cambio_guardia` DROP FOREIGN KEY `FK_285F0433E4517BDD`;

-- DropForeignKey
ALTER TABLE `c_cambio_horario` DROP FOREIGN KEY `FK_E6A5B2C1186B3418`;

-- DropForeignKey
ALTER TABLE `c_cambio_horario` DROP FOREIGN KEY `FK_E6A5B2C16E94741B`;

-- DropForeignKey
ALTER TABLE `c_cambio_horario` DROP FOREIGN KEY `FK_E6A5B2C1AF8A0D2D`;

-- DropForeignKey
ALTER TABLE `c_cambio_horario` DROP FOREIGN KEY `FK_E6A5B2C1B8F00EA0`;

-- DropForeignKey
ALTER TABLE `c_cambio_periodo_pago` DROP FOREIGN KEY `FK_C869871ABB712BEE`;

-- DropForeignKey
ALTER TABLE `c_cambio_periodo_pago` DROP FOREIGN KEY `FK_C869871ACD4171BE`;

-- DropForeignKey
ALTER TABLE `c_curso_empleado` DROP FOREIGN KEY `FK_EF09AA1287CB4A1F`;

-- DropForeignKey
ALTER TABLE `c_curso_empleado` DROP FOREIGN KEY `FK_EF09AA12952BE730`;

-- DropForeignKey
ALTER TABLE `c_deudas` DROP FOREIGN KEY `FK_8AB91D2C6C9408BE`;

-- DropForeignKey
ALTER TABLE `c_deudas` DROP FOREIGN KEY `FK_8AB91D2C952BE730`;

-- DropForeignKey
ALTER TABLE `c_embargos_judiciales` DROP FOREIGN KEY `FK_68326432C5CAD3D1`;

-- DropForeignKey
ALTER TABLE `c_embargos_pension_alimentaria` DROP FOREIGN KEY `FK_B2678676C5CAD3D1`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A3999114FAA7C`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A399919E9AC5F`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A39991CB9D6E4`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A399928F0D5CA`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A39992BAEF284`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A399955CD1AE4`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A39995EEC5E1B`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A39996EA899DA`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A399979F98940`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A39998D7C55D2`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A3999996BD967`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A3999A07740F`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A3999AB8DC0F8`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A3999B0B41592`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A3999CC04A73E`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A3999D2624C39`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A3999ED33694C`;

-- DropForeignKey
ALTER TABLE `c_empleado` DROP FOREIGN KEY `FK_C84A3999FCBB0AEC`;

-- DropForeignKey
ALTER TABLE `c_empleado_basedatos_digital` DROP FOREIGN KEY `FK_9BF4295A1CB9D6E4`;

-- DropForeignKey
ALTER TABLE `c_empleado_basedatos_digital` DROP FOREIGN KEY `FK_9BF4295A952BE730`;

-- DropForeignKey
ALTER TABLE `c_empleado_datos_adjuntos_rrhh` DROP FOREIGN KEY `FK_FE891195A2DE568`;

-- DropForeignKey
ALTER TABLE `c_empleado_datos_adjuntos_rrhh` DROP FOREIGN KEY `FK_FE89119952BE730`;

-- DropForeignKey
ALTER TABLE `c_empleado_gasto_principal` DROP FOREIGN KEY `FK_6136C13518864C8`;

-- DropForeignKey
ALTER TABLE `c_empleado_gasto_principal` DROP FOREIGN KEY `FK_6136C13DAB52E4B`;

-- DropForeignKey
ALTER TABLE `c_empleado_plaza` DROP FOREIGN KEY `FK_9F05308D3C5F34F`;

-- DropForeignKey
ALTER TABLE `c_empleado_plaza` DROP FOREIGN KEY `FK_9F05308D41859289`;

-- DropForeignKey
ALTER TABLE `c_empleado_plaza` DROP FOREIGN KEY `FK_9F05308D4959F1BA`;

-- DropForeignKey
ALTER TABLE `c_empleado_plaza` DROP FOREIGN KEY `FK_9F05308D5035E9DA`;

-- DropForeignKey
ALTER TABLE `c_empleado_plaza` DROP FOREIGN KEY `FK_9F05308D521E1991`;

-- DropForeignKey
ALTER TABLE `c_empleado_plaza` DROP FOREIGN KEY `FK_9F05308D5CAEAC5D`;

-- DropForeignKey
ALTER TABLE `c_empleado_plaza` DROP FOREIGN KEY `FK_9F05308D70AE7BF1`;

-- DropForeignKey
ALTER TABLE `c_empleado_plaza` DROP FOREIGN KEY `FK_9F05308D952BE730`;

-- DropForeignKey
ALTER TABLE `c_empleado_plaza` DROP FOREIGN KEY `FK_9F05308DDE734E51`;

-- DropForeignKey
ALTER TABLE `c_empleado_plaza` DROP FOREIGN KEY `FK_9F05308DEF34C0BD`;

-- DropForeignKey
ALTER TABLE `c_empleado_referencias` DROP FOREIGN KEY `FK_E5ADCE2D1CB9D6E4`;

-- DropForeignKey
ALTER TABLE `c_empleado_referencias` DROP FOREIGN KEY `FK_E5ADCE2D2BAEF284`;

-- DropForeignKey
ALTER TABLE `c_empleado_referencias` DROP FOREIGN KEY `FK_E5ADCE2D952BE730`;

-- DropForeignKey
ALTER TABLE `c_empleado_referencias` DROP FOREIGN KEY `FK_E5ADCE2DD3F1ED37`;

-- DropForeignKey
ALTER TABLE `c_empleado_registro_laboral` DROP FOREIGN KEY `FK_30CD41E5952BE730`;

-- DropForeignKey
ALTER TABLE `c_empleado_registro_laboral` DROP FOREIGN KEY `FK_30CD41E5AC3051D`;

-- DropForeignKey
ALTER TABLE `c_empleado_sindicato` DROP FOREIGN KEY `FK_7F8A7D598D7C55D2`;

-- DropForeignKey
ALTER TABLE `c_empleado_sindicato` DROP FOREIGN KEY `FK_7F8A7D59952BE730`;

-- DropForeignKey
ALTER TABLE `c_empleado_sindicato_adjuntos` DROP FOREIGN KEY `FK_2CD97FCF6F9D0169`;

-- DropForeignKey
ALTER TABLE `c_empleado_tramite_portacion_arma` DROP FOREIGN KEY `FK_E46810F952BE730`;

-- DropForeignKey
ALTER TABLE `c_extra_limite_semanal` DROP FOREIGN KEY `FK_A0512A95952BE730`;

-- DropForeignKey
ALTER TABLE `c_extra_tarifa_corpo` DROP FOREIGN KEY `FK_E3FAC1FB279A5D5E`;

-- DropForeignKey
ALTER TABLE `c_extra_tarifa_corpo` DROP FOREIGN KEY `FK_E3FAC1FB3AD4FFE2`;

-- DropForeignKey
ALTER TABLE `c_extra_tarifa_rango` DROP FOREIGN KEY `FK_4E1AD678ED0E28FB`;

-- DropForeignKey
ALTER TABLE `c_fecha_excepcional` DROP FOREIGN KEY `FK_403BB7FF4959F1BA`;

-- DropForeignKey
ALTER TABLE `c_fecha_excepcional` DROP FOREIGN KEY `FK_403BB7FF952BE730`;

-- DropForeignKey
ALTER TABLE `c_feriado_dia` DROP FOREIGN KEY `FK_9B00E14AB1C52DFC`;

-- DropForeignKey
ALTER TABLE `c_horario_dia` DROP FOREIGN KEY `FK_E719D4BD4959F1BA`;

-- DropForeignKey
ALTER TABLE `c_horario_dia` DROP FOREIGN KEY `FK_E719D4BDEF34C0BD`;

-- DropForeignKey
ALTER TABLE `c_horas_extras` DROP FOREIGN KEY `FK_C_HORAS_EMPLEADO`;

-- DropForeignKey
ALTER TABLE `c_incapacidad_ins` DROP FOREIGN KEY `FK_80539B87521E1991`;

-- DropForeignKey
ALTER TABLE `c_incapacidad_ins` DROP FOREIGN KEY `FK_80539B87DE78DC57`;

-- DropForeignKey
ALTER TABLE `c_induccion` DROP FOREIGN KEY `FK_371730A5035E9DA`;

-- DropForeignKey
ALTER TABLE `c_induccion` DROP FOREIGN KEY `FK_371730A952BE730`;

-- DropForeignKey
ALTER TABLE `c_induccion_dia` DROP FOREIGN KEY `FK_E5590D543CEEDC64`;

-- DropForeignKey
ALTER TABLE `c_induccion_dia` DROP FOREIGN KEY `FK_E5590D54EF34C0BD`;

-- DropForeignKey
ALTER TABLE `c_inducciones` DROP FOREIGN KEY `FK_A3BC66E62B959FC6`;

-- DropForeignKey
ALTER TABLE `c_inducciones` DROP FOREIGN KEY `FK_A3BC66E681B56B3`;

-- DropForeignKey
ALTER TABLE `c_inducciones` DROP FOREIGN KEY `FK_A3BC66E6952BE730`;

-- DropForeignKey
ALTER TABLE `c_inducciones` DROP FOREIGN KEY `FK_A3BC66E6A65E775D`;

-- DropForeignKey
ALTER TABLE `c_inducciones` DROP FOREIGN KEY `FK_A3BC66E6B304894A`;

-- DropForeignKey
ALTER TABLE `c_inducciones` DROP FOREIGN KEY `FK_A3BC66E6C968E4B9`;

-- DropForeignKey
ALTER TABLE `c_inducciones` DROP FOREIGN KEY `FK_A3BC66E6E4517BDD`;

-- DropForeignKey
ALTER TABLE `c_intercambio_linea` DROP FOREIGN KEY `FK_88E784CE4BC37A6F`;

-- DropForeignKey
ALTER TABLE `c_intercambio_linea` DROP FOREIGN KEY `FK_88E784CE77BB7125`;

-- DropForeignKey
ALTER TABLE `c_intercambio_linea` DROP FOREIGN KEY `FK_88E784CE952BE730`;

-- DropForeignKey
ALTER TABLE `c_intercambio_linea` DROP FOREIGN KEY `FK_88E784CEAED3850`;

-- DropForeignKey
ALTER TABLE `c_intercambio_linea` DROP FOREIGN KEY `FK_88E784CEF883EFAA`;

-- DropForeignKey
ALTER TABLE `c_roltipoaccion_tipoaccion` DROP FOREIGN KEY `FK_48CD1A52C9F2F869`;

-- DropForeignKey
ALTER TABLE `c_roltipoaccion_tipoaccion` DROP FOREIGN KEY `FK_48CD1A52E93DD86B`;

-- DropForeignKey
ALTER TABLE `c_separacion_temp` DROP FOREIGN KEY `FK_540A8D7C9F59AD70`;

-- DropForeignKey
ALTER TABLE `c_solicitud_empleo` DROP FOREIGN KEY `FK_4F8484C018586848`;

-- DropForeignKey
ALTER TABLE `c_solicitud_empleo` DROP FOREIGN KEY `FK_4F8484C02BAEF284`;

-- DropForeignKey
ALTER TABLE `c_solicitud_empleo` DROP FOREIGN KEY `FK_4F8484C041859289`;

-- DropForeignKey
ALTER TABLE `c_solicitud_empleo` DROP FOREIGN KEY `FK_4F8484C04E7121AF`;

-- DropForeignKey
ALTER TABLE `c_solicitud_empleo` DROP FOREIGN KEY `FK_4F8484C06AC7D228`;

-- DropForeignKey
ALTER TABLE `c_solicitud_empleo` DROP FOREIGN KEY `FK_4F8484C08B34DB71`;

-- DropForeignKey
ALTER TABLE `c_solicitud_empleo` DROP FOREIGN KEY `FK_4F8484C08D070D0B`;

-- DropForeignKey
ALTER TABLE `c_solicitud_empleo` DROP FOREIGN KEY `FK_4F8484C08E099F24`;

-- DropForeignKey
ALTER TABLE `c_solicitud_empleo` DROP FOREIGN KEY `FK_4F8484C098260155`;

-- DropForeignKey
ALTER TABLE `c_solicitud_empleo` DROP FOREIGN KEY `FK_4F8484C0AB8DC0F8`;

-- DropForeignKey
ALTER TABLE `c_solicitud_empleo` DROP FOREIGN KEY `FK_4F8484C0B894E495`;

-- DropForeignKey
ALTER TABLE `c_solicitud_empleo` DROP FOREIGN KEY `FK_4F8484C0E557397E`;

-- DropForeignKey
ALTER TABLE `c_solicitud_empleo_adjunto` DROP FOREIGN KEY `FK_55893DCD1CB9D6E4`;

-- DropForeignKey
ALTER TABLE `c_solicitudempleo__n_idioma` DROP FOREIGN KEY `FK_38D7303214714E0A`;

-- DropForeignKey
ALTER TABLE `c_solicitudempleo__n_idioma` DROP FOREIGN KEY `FK_38D730324248037D`;

-- DropForeignKey
ALTER TABLE `c_tramite_portacion_arma` DROP FOREIGN KEY `FK_B71936626D892826`;

-- DropForeignKey
ALTER TABLE `c_traslado_temp` DROP FOREIGN KEY `FK_7B0E282C1B482BBB`;

-- DropForeignKey
ALTER TABLE `consultor_actualizacion` DROP FOREIGN KEY `FK_A7D941FB4E7121AF`;

-- DropForeignKey
ALTER TABLE `consultor_actualizacion` DROP FOREIGN KEY `FK_A7D941FB8D070D0B`;

-- DropForeignKey
ALTER TABLE `consultor_actualizacion` DROP FOREIGN KEY `FK_A7D941FB952BE730`;

-- DropForeignKey
ALTER TABLE `consultor_actualizacion` DROP FOREIGN KEY `FK_A7D941FBE557397E`;

-- DropForeignKey
ALTER TABLE `consultor_actualizacion_telefonos` DROP FOREIGN KEY `FK_2CF2054CDF01D38`;

-- DropForeignKey
ALTER TABLE `consultor_history_checked_update` DROP FOREIGN KEY `FK_37A84590952BE730`;

-- DropForeignKey
ALTER TABLE `consultor_log` DROP FOREIGN KEY `FK_45A0E79B1CB9D6E4`;

-- DropForeignKey
ALTER TABLE `consultor_log` DROP FOREIGN KEY `FK_45A0E79B952BE730`;

-- DropForeignKey
ALTER TABLE `d_empleado_cartas_recomendacion` DROP FOREIGN KEY `FK_244336C1CB9D6E4`;

-- DropForeignKey
ALTER TABLE `d_empleado_cartas_recomendacion` DROP FOREIGN KEY `FK_244336C952BE730`;

-- DropForeignKey
ALTER TABLE `d_empleado_hoja_delincuencia` DROP FOREIGN KEY `FK_D39F3EAF1CB9D6E4`;

-- DropForeignKey
ALTER TABLE `d_empleado_hoja_delincuencia` DROP FOREIGN KEY `FK_D39F3EAF952BE730`;

-- DropForeignKey
ALTER TABLE `d_empleado_otras_anotaciones` DROP FOREIGN KEY `FK_CAA044011CB9D6E4`;

-- DropForeignKey
ALTER TABLE `d_empleado_otras_anotaciones` DROP FOREIGN KEY `FK_CAA04401952BE730`;

-- DropForeignKey
ALTER TABLE `e_antecedente_penal` DROP FOREIGN KEY `FK_47E60268952BE730`;

-- DropForeignKey
ALTER TABLE `e_cuenta_banco_empleado` DROP FOREIGN KEY `FK_DBE7C3CB952BE730`;

-- DropForeignKey
ALTER TABLE `e_cuenta_banco_empleado` DROP FOREIGN KEY `FK_DBE7C3CBCC04A73E`;

-- DropForeignKey
ALTER TABLE `e_cursos` DROP FOREIGN KEY `FK_2B0E1353952BE730`;

-- DropForeignKey
ALTER TABLE `e_dato_legal` DROP FOREIGN KEY `FK_3E0AEB71952BE730`;

-- DropForeignKey
ALTER TABLE `e_domicilio` DROP FOREIGN KEY `FK_7F866C2C952BE730`;

-- DropForeignKey
ALTER TABLE `e_domicilio` DROP FOREIGN KEY `FK_7F866C2C98260155`;

-- DropForeignKey
ALTER TABLE `e_domicilio` DROP FOREIGN KEY `FK_7F866C2CE557397E`;

-- DropForeignKey
ALTER TABLE `e_educacion` DROP FOREIGN KEY `FK_F2D67309952BE730`;

-- DropForeignKey
ALTER TABLE `e_educacion_idiomas` DROP FOREIGN KEY `FK_52B18791952BE730`;

-- DropForeignKey
ALTER TABLE `e_educacion_idiomas` DROP FOREIGN KEY `FK_52B18791DEDC0611`;

-- DropForeignKey
ALTER TABLE `e_empleado_incumplimiento` DROP FOREIGN KEY `FK_7D24EC63952BE730`;

-- DropForeignKey
ALTER TABLE `e_empleado_incumplimiento` DROP FOREIGN KEY `FK_7D24EC63B0DCC882`;

-- DropForeignKey
ALTER TABLE `e_empleado_incumplimiento__n_motivo` DROP FOREIGN KEY `FK_A8E899CD37734155`;

-- DropForeignKey
ALTER TABLE `e_empleado_incumplimiento__n_motivo` DROP FOREIGN KEY `FK_A8E899CD517A96A9`;

-- DropForeignKey
ALTER TABLE `e_empleado_incumplimiento_accion` DROP FOREIGN KEY `FK_5FD783337734155`;

-- DropForeignKey
ALTER TABLE `e_empleado_lista_negra` DROP FOREIGN KEY `FK_69D24DF1279A5D5E`;

-- DropForeignKey
ALTER TABLE `e_empleado_lista_negra` DROP FOREIGN KEY `FK_69D24DF1952BE730`;

-- DropForeignKey
ALTER TABLE `e_empleado_lista_negra` DROP FOREIGN KEY `FK_69D24DF1DE734E51`;

-- DropForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_entrega` DROP FOREIGN KEY `FK_9BAD26993C5F34F`;

-- DropForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_entrega` DROP FOREIGN KEY `FK_9BAD26995035E9DA`;

-- DropForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_entrega` DROP FOREIGN KEY `FK_9BAD269985828A9B`;

-- DropForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` DROP FOREIGN KEY `FK_AAD537C43C5F34F`;

-- DropForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` DROP FOREIGN KEY `FK_AAD537C45035E9DA`;

-- DropForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` DROP FOREIGN KEY `FK_AAD537C4EB6587E3`;

-- DropForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` DROP FOREIGN KEY `FK_AAD537C4EDDDC6B`;

-- DropForeignKey
ALTER TABLE `e_estructura_bonificaciones_plaza` DROP FOREIGN KEY `FK_89391A8D86CE56DC`;

-- DropForeignKey
ALTER TABLE `e_estructura_bonificaciones_plaza` DROP FOREIGN KEY `FK_89391A8DEF34C0BD`;

-- DropForeignKey
ALTER TABLE `e_estructura_cliente` DROP FOREIGN KEY `FK_AE021871521E1991`;

-- DropForeignKey
ALTER TABLE `e_estructura_cliente_usuario` DROP FOREIGN KEY `FK_E039927BA76ED395`;

-- DropForeignKey
ALTER TABLE `e_estructura_cliente_usuario` DROP FOREIGN KEY `FK_E039927BDE734E51`;

-- DropForeignKey
ALTER TABLE `e_estructura_contrato` DROP FOREIGN KEY `FK_A35EE4D41859289`;

-- DropForeignKey
ALTER TABLE `e_estructura_contrato` DROP FOREIGN KEY `FK_A35EE4D4FF0676`;

-- DropForeignKey
ALTER TABLE `e_estructura_contrato` DROP FOREIGN KEY `FK_A35EE4D521E1991`;

-- DropForeignKey
ALTER TABLE `e_estructura_contrato` DROP FOREIGN KEY `FK_A35EE4D76490E74`;

-- DropForeignKey
ALTER TABLE `e_estructura_contrato` DROP FOREIGN KEY `FK_A35EE4DDE734E51`;

-- DropForeignKey
ALTER TABLE `e_estructura_curso_contrato` DROP FOREIGN KEY `FK_93FF31DC70AE7BF1`;

-- DropForeignKey
ALTER TABLE `e_estructura_curso_contrato` DROP FOREIGN KEY `FK_93FF31DC87CB4A1F`;

-- DropForeignKey
ALTER TABLE `e_estructura_dia_excepcion_plaza` DROP FOREIGN KEY `FK_640C22F132838645`;

-- DropForeignKey
ALTER TABLE `e_estructura_dia_excepcion_plaza` DROP FOREIGN KEY `FK_640C22F1EF34C0BD`;

-- DropForeignKey
ALTER TABLE `e_estructura_dia_excepcion_puesto` DROP FOREIGN KEY `FK_1F27E2D35035E9DA`;

-- DropForeignKey
ALTER TABLE `e_estructura_empleado_autorizado_contrato` DROP FOREIGN KEY `FK_8E302ED270AE7BF1`;

-- DropForeignKey
ALTER TABLE `e_estructura_empleado_autorizado_contrato` DROP FOREIGN KEY `FK_8E302ED2952BE730`;

-- DropForeignKey
ALTER TABLE `e_estructura_historico_contrato` DROP FOREIGN KEY `FK_688D970F70AE7BF1`;

-- DropForeignKey
ALTER TABLE `e_estructura_historico_contrato` DROP FOREIGN KEY `FK_688D970F84F63C81`;

-- DropForeignKey
ALTER TABLE `e_estructura_horario_plaza_historial` DROP FOREIGN KEY `FK_F4AAD92F4959F1BA`;

-- DropForeignKey
ALTER TABLE `e_estructura_horario_plaza_historial` DROP FOREIGN KEY `FK_F4AAD92FEF34C0BD`;

-- DropForeignKey
ALTER TABLE `e_estructura_horariopuesto_dia` DROP FOREIGN KEY `FK_2968410A4959F1BA`;

-- DropForeignKey
ALTER TABLE `e_estructura_plazas` DROP FOREIGN KEY `FK_92687E504BAB96C`;

-- DropForeignKey
ALTER TABLE `e_estructura_plazas` DROP FOREIGN KEY `FK_92687E505035E9DA`;

-- DropForeignKey
ALTER TABLE `e_estructura_plazas` DROP FOREIGN KEY `FK_92687E5066A839D6`;

-- DropForeignKey
ALTER TABLE `e_estructura_plazas` DROP FOREIGN KEY `FK_92687E50A07740F`;

-- DropForeignKey
ALTER TABLE `e_estructura_plazas` DROP FOREIGN KEY `FK_92687E50F4C2234D`;

-- DropForeignKey
ALTER TABLE `e_estructura_puesto` DROP FOREIGN KEY `FK_5C9F9D20279A5D5E`;

-- DropForeignKey
ALTER TABLE `e_estructura_puesto` DROP FOREIGN KEY `FK_5C9F9D202AC174D0`;

-- DropForeignKey
ALTER TABLE `e_estructura_puesto` DROP FOREIGN KEY `FK_5C9F9D207A17505D`;

-- DropForeignKey
ALTER TABLE `e_estructura_puesto` DROP FOREIGN KEY `FK_5C9F9D209FF23C2C`;

-- DropForeignKey
ALTER TABLE `e_estructura_puesto` DROP FOREIGN KEY `FK_5C9F9D20EB6A1B22`;

-- DropForeignKey
ALTER TABLE `e_estructura_requerimiento_contrato` DROP FOREIGN KEY `FK_D5DEDC5251DD0900`;

-- DropForeignKey
ALTER TABLE `e_estructura_requerimiento_contrato` DROP FOREIGN KEY `FK_D5DEDC5270AE7BF1`;

-- DropForeignKey
ALTER TABLE `e_estructura_sucursal` DROP FOREIGN KEY `FK_85C0E6384E7121AF`;

-- DropForeignKey
ALTER TABLE `e_estructura_sucursal` DROP FOREIGN KEY `FK_85C0E6385CAEAC5D`;

-- DropForeignKey
ALTER TABLE `e_estructura_sucursal` DROP FOREIGN KEY `FK_85C0E63870AE7BF1`;

-- DropForeignKey
ALTER TABLE `e_estructura_sucursal` DROP FOREIGN KEY `FK_85C0E6387A17505D`;

-- DropForeignKey
ALTER TABLE `e_estructura_sucursal` DROP FOREIGN KEY `FK_85C0E6388D070D0B`;

-- DropForeignKey
ALTER TABLE `e_estructura_sucursal` DROP FOREIGN KEY `FK_85C0E63898260155`;

-- DropForeignKey
ALTER TABLE `e_estructura_sucursal` DROP FOREIGN KEY `FK_85C0E638E557397E`;

-- DropForeignKey
ALTER TABLE `e_familia` DROP FOREIGN KEY `FK_BFFE2C1E5BA311FC`;

-- DropForeignKey
ALTER TABLE `e_familia` DROP FOREIGN KEY `FK_BFFE2C1E952BE730`;

-- DropForeignKey
ALTER TABLE `e_familia` DROP FOREIGN KEY `FK_BFFE2C1ED8999C67`;

-- DropForeignKey
ALTER TABLE `e_historia_salud` DROP FOREIGN KEY `FK_DBC9ED35952BE730`;

-- DropForeignKey
ALTER TABLE `e_historia_salud_deportes` DROP FOREIGN KEY `FK_C8CA2E312AC5252B`;

-- DropForeignKey
ALTER TABLE `e_historia_salud_deportes` DROP FOREIGN KEY `FK_C8CA2E31CE01478D`;

-- DropForeignKey
ALTER TABLE `e_historia_salud_juego_azar` DROP FOREIGN KEY `FK_A5E83ADC2AC5252B`;

-- DropForeignKey
ALTER TABLE `e_historia_salud_juego_azar` DROP FOREIGN KEY `FK_A5E83ADCCB6A38C4`;

-- DropForeignKey
ALTER TABLE `e_historia_salud_tipo_enfermedad` DROP FOREIGN KEY `FK_68A643A55E542676`;

-- DropForeignKey
ALTER TABLE `e_historia_salud_tipo_enfermedad` DROP FOREIGN KEY `FK_68A643A571AC4617`;

-- DropForeignKey
ALTER TABLE `e_historia_trabajo` DROP FOREIGN KEY `FK_C3C4D66952BE730`;

-- DropForeignKey
ALTER TABLE `e_informacion_educacional` DROP FOREIGN KEY `FK_4ECC8A5654204EE1`;

-- DropForeignKey
ALTER TABLE `e_informacion_educacional` DROP FOREIGN KEY `FK_4ECC8A568ED81F31`;

-- DropForeignKey
ALTER TABLE `e_licencia` DROP FOREIGN KEY `FK_209564874E5E27A4`;

-- DropForeignKey
ALTER TABLE `e_licencia` DROP FOREIGN KEY `FK_20956487952BE730`;

-- DropForeignKey
ALTER TABLE `e_persona_dependen` DROP FOREIGN KEY `FK_708D21555BA311FC`;

-- DropForeignKey
ALTER TABLE `e_persona_dependen` DROP FOREIGN KEY `FK_708D2155952BE730`;

-- DropForeignKey
ALTER TABLE `e_persona_dependen` DROP FOREIGN KEY `FK_708D2155D8999C67`;

-- DropForeignKey
ALTER TABLE `e_persona_empresa` DROP FOREIGN KEY `FK_61EEE3DCA57A8FE0`;

-- DropForeignKey
ALTER TABLE `e_referencia_personal` DROP FOREIGN KEY `FK_BFAFF6A4952BE730`;

-- DropForeignKey
ALTER TABLE `e_registro_enfermedades` DROP FOREIGN KEY `FK_946DE77A952BE730`;

-- DropForeignKey
ALTER TABLE `e_registro_habilidades` DROP FOREIGN KEY `FK_7BA0E6E9952BE730`;

-- DropForeignKey
ALTER TABLE `e_requerimiento_cumplido` DROP FOREIGN KEY `FK_BB503B1551DD0900`;

-- DropForeignKey
ALTER TABLE `e_requerimiento_cumplido` DROP FOREIGN KEY `FK_BB503B15952BE730`;

-- DropForeignKey
ALTER TABLE `e_trabajo` DROP FOREIGN KEY `FK_1C41565B952BE730`;

-- DropForeignKey
ALTER TABLE `e_trabajo` DROP FOREIGN KEY `FK_1C41565BC2D4D747`;

-- DropForeignKey
ALTER TABLE `log_horario` DROP FOREIGN KEY `FK_DA956B344959F1BA`;

-- DropForeignKey
ALTER TABLE `m_comodin_ausente` DROP FOREIGN KEY `FK_512A0FBD952BE730`;

-- DropForeignKey
ALTER TABLE `m_puesto_no_cubierto` DROP FOREIGN KEY `FK_61ED7883952BE730`;

-- DropForeignKey
ALTER TABLE `m_puesto_no_cubierto` DROP FOREIGN KEY `FK_61ED7883C49D574A`;

-- DropForeignKey
ALTER TABLE `m_puesto_no_cubierto` DROP FOREIGN KEY `FK_61ED7883EF34C0BD`;

-- DropForeignKey
ALTER TABLE `m_refuerzo` DROP FOREIGN KEY `FK_E14C49FC2B959FC6`;

-- DropForeignKey
ALTER TABLE `m_refuerzo` DROP FOREIGN KEY `FK_E14C49FC3C5F34F`;

-- DropForeignKey
ALTER TABLE `m_refuerzo` DROP FOREIGN KEY `FK_E14C49FC952BE730`;

-- DropForeignKey
ALTER TABLE `m_refuerzo` DROP FOREIGN KEY `FK_E14C49FCEF34C0BD`;

-- DropForeignKey
ALTER TABLE `m_reposicion_de_horas` DROP FOREIGN KEY `FK_35E7E0D45035E9DA`;

-- DropForeignKey
ALTER TABLE `m_reposicion_de_horas` DROP FOREIGN KEY `FK_35E7E0D4952BE730`;

-- DropForeignKey
ALTER TABLE `m_rol_monitoreo_contrato` DROP FOREIGN KEY `FK_98623F170AE7BF1`;

-- DropForeignKey
ALTER TABLE `m_rol_monitoreo_contrato` DROP FOREIGN KEY `FK_98623F1CECCB70E`;

-- DropForeignKey
ALTER TABLE `m_rol_monitoreo_sucursal` DROP FOREIGN KEY `FK_86732B84279A5D5E`;

-- DropForeignKey
ALTER TABLE `m_rol_monitoreo_sucursal` DROP FOREIGN KEY `FK_86732B84CECCB70E`;

-- DropForeignKey
ALTER TABLE `m_turno_activo` DROP FOREIGN KEY `FK_CC1DB0AE2F4E077F`;

-- DropForeignKey
ALTER TABLE `n_apoderado` DROP FOREIGN KEY `FK_2D844777952BE730`;

-- DropForeignKey
ALTER TABLE `n_articulo_uniforme` DROP FOREIGN KEY `FK_429432F081E7650`;

-- DropForeignKey
ALTER TABLE `n_canton` DROP FOREIGN KEY `FK_9F82AC3C4E7121AF`;

-- DropForeignKey
ALTER TABLE `n_coordinador` DROP FOREIGN KEY `FK_D7D149E781B56B3`;

-- DropForeignKey
ALTER TABLE `n_distrito` DROP FOREIGN KEY `FK_5A4A14868D070D0B`;

-- DropForeignKey
ALTER TABLE `n_empresa_banco` DROP FOREIGN KEY `FK_F5709BC0521E1991`;

-- DropForeignKey
ALTER TABLE `n_empresa_banco` DROP FOREIGN KEY `FK_F5709BC0CC04A73E`;

-- DropForeignKey
ALTER TABLE `n_empresa_poliza` DROP FOREIGN KEY `FK_1223BAD041859289`;

-- DropForeignKey
ALTER TABLE `n_empresa_poliza` DROP FOREIGN KEY `FK_1223BAD0521E1991`;

-- DropForeignKey
ALTER TABLE `n_motivo_extra` DROP FOREIGN KEY `FK_A3B0B86EB5523D4D`;

-- DropForeignKey
ALTER TABLE `n_pago_turno` DROP FOREIGN KEY `FK_971CFF176065BC38`;

-- DropForeignKey
ALTER TABLE `n_pago_turno` DROP FOREIGN KEY `FK_971CFF1769C5211E`;

-- DropForeignKey
ALTER TABLE `n_requerimiento` DROP FOREIGN KEY `FK_529C438AB1D10646`;

-- DropForeignKey
ALTER TABLE `p_periodopago` DROP FOREIGN KEY `FK_31023814D035117`;

-- DropForeignKey
ALTER TABLE `p_planillas` DROP FOREIGN KEY `FK_A4977423D2624C39`;

-- DropForeignKey
ALTER TABLE `p_planillas_bonificaciones_pagadas` DROP FOREIGN KEY `FK_12CD2767799EE823`;

-- DropForeignKey
ALTER TABLE `p_planillas_bonificaciones_pagadas` DROP FOREIGN KEY `FK_12CD276786CE56DC`;

-- DropForeignKey
ALTER TABLE `p_planillas_bonificaciones_plaza_pagadas` DROP FOREIGN KEY `FK_9F2F7DE7799EE823`;

-- DropForeignKey
ALTER TABLE `p_planillas_bonificaciones_plaza_pagadas` DROP FOREIGN KEY `FK_9F2F7DE7E084692E`;

-- DropForeignKey
ALTER TABLE `p_planillas_deudas_pagadas` DROP FOREIGN KEY `FK_A96F6365799EE823`;

-- DropForeignKey
ALTER TABLE `p_planillas_deudas_pagadas` DROP FOREIGN KEY `FK_A96F6365C5CAD3D1`;

-- DropForeignKey
ALTER TABLE `p_planillas_dia_menos_descontado` DROP FOREIGN KEY `FK_DBC74561799EE823`;

-- DropForeignKey
ALTER TABLE `p_planillas_empleado` DROP FOREIGN KEY `FK_CC9DC074952BE730`;

-- DropForeignKey
ALTER TABLE `p_planillas_empleado` DROP FOREIGN KEY `FK_CC9DC074F747F090`;

-- DropForeignKey
ALTER TABLE `pg_categoria_salarial` DROP FOREIGN KEY `FK_E3A1F6CBED33694C`;

-- DropForeignKey
ALTER TABLE `pg_categoria_salarial_log` DROP FOREIGN KEY `FK_5C4E2930ED33694C`;

-- DropForeignKey
ALTER TABLE `pg_categoria_salarial_log` DROP FOREIGN KEY `FK_5C4E2930F4C2234D`;

-- DropForeignKey
ALTER TABLE `pg_pago_turno_semanal` DROP FOREIGN KEY `FK_99D45AACED33694C`;

-- DropForeignKey
ALTER TABLE `pg_pago_turno_semanal_log` DROP FOREIGN KEY `FK_C845571FA0E9F09B`;

-- DropForeignKey
ALTER TABLE `pg_pago_turno_semanal_log` DROP FOREIGN KEY `FK_C845571FED33694C`;

-- DropForeignKey
ALTER TABLE `pg_pe_bonif_empl_pagado` DROP FOREIGN KEY `FK_1ED55932799EE823`;

-- DropForeignKey
ALTER TABLE `pg_pe_bonif_empl_pagado` DROP FOREIGN KEY `FK_1ED5593286CE56DC`;

-- DropForeignKey
ALTER TABLE `pg_pe_bonif_plaza_pagado` DROP FOREIGN KEY `FK_AB69EBC4799EE823`;

-- DropForeignKey
ALTER TABLE `pg_pe_bonif_plaza_pagado` DROP FOREIGN KEY `FK_AB69EBC486CE56DC`;

-- DropForeignKey
ALTER TABLE `pg_pe_deuda_descontado` DROP FOREIGN KEY `FK_8BF9D6E9799EE823`;

-- DropForeignKey
ALTER TABLE `pg_pe_deuda_descontado` DROP FOREIGN KEY `FK_8BF9D6E9C5CAD3D1`;

-- DropForeignKey
ALTER TABLE `pg_pe_dia` DROP FOREIGN KEY `FK_11D3EF533FBAC2B`;

-- DropForeignKey
ALTER TABLE `pg_pe_dia` DROP FOREIGN KEY `FK_11D3EF53436B53E8`;

-- DropForeignKey
ALTER TABLE `pg_pe_dia` DROP FOREIGN KEY `FK_11D3EF53799EE823`;

-- DropForeignKey
ALTER TABLE `pg_pe_feriado_dia_pagado` DROP FOREIGN KEY `FK_EAF51CE1799EE823`;

-- DropForeignKey
ALTER TABLE `pg_pe_feriado_dia_pagado` DROP FOREIGN KEY `FK_EAF51CE1E2194A39`;

-- DropForeignKey
ALTER TABLE `pg_pe_incapacidad_pagado` DROP FOREIGN KEY `FK_FEB9C1B02EDBF996`;

-- DropForeignKey
ALTER TABLE `pg_pe_incapacidad_pagado` DROP FOREIGN KEY `FK_FEB9C1B0799EE823`;

-- DropForeignKey
ALTER TABLE `pg_pe_induccion_dia_pagado` DROP FOREIGN KEY `FK_869A86811D6FE1F6`;

-- DropForeignKey
ALTER TABLE `pg_pe_induccion_dia_pagado` DROP FOREIGN KEY `FK_869A8681799EE823`;

-- DropForeignKey
ALTER TABLE `pg_pe_rebajo_sindicato_pagado` DROP FOREIGN KEY `FK_D0FCC65257F57AE7`;

-- DropForeignKey
ALTER TABLE `pg_pe_rebajo_sindicato_pagado` DROP FOREIGN KEY `FK_D0FCC6526F9D0169`;

-- DropForeignKey
ALTER TABLE `pg_pe_refuerzo_dia_pagado` DROP FOREIGN KEY `FK_C5D26D6632F8140A`;

-- DropForeignKey
ALTER TABLE `pg_pe_refuerzo_dia_pagado` DROP FOREIGN KEY `FK_C5D26D66799EE823`;

-- DropForeignKey
ALTER TABLE `pg_planilla_empleado` DROP FOREIGN KEY `FK_1465F95E3C5F34F`;

-- DropForeignKey
ALTER TABLE `pg_planilla_empleado` DROP FOREIGN KEY `FK_1465F95E4959F1BA`;

-- DropForeignKey
ALTER TABLE `pg_planilla_empleado` DROP FOREIGN KEY `FK_1465F95E70AE7BF1`;

-- DropForeignKey
ALTER TABLE `pg_planilla_empleado` DROP FOREIGN KEY `FK_1465F95E952BE730`;

-- DropForeignKey
ALTER TABLE `pg_planilla_empleado` DROP FOREIGN KEY `FK_1465F95EB1C7830E`;

-- DropForeignKey
ALTER TABLE `pg_planilla_empleado` DROP FOREIGN KEY `FK_1465F95EEF34C0BD`;

-- DropForeignKey
ALTER TABLE `pg_planilla_empleado` DROP FOREIGN KEY `FK_1465F95EF747F090`;

-- DropForeignKey
ALTER TABLE `pg_planilla_extra` DROP FOREIGN KEY `FK_3764CFDF521E1991`;

-- DropForeignKey
ALTER TABLE `pg_planilla_extra` DROP FOREIGN KEY `FK_3764CFDFCC04A73E`;

-- DropForeignKey
ALTER TABLE `pg_planilla_extra_empleado` DROP FOREIGN KEY `FK_F9A77EA2521E1991`;

-- DropForeignKey
ALTER TABLE `pg_planilla_extra_empleado` DROP FOREIGN KEY `FK_F9A77EA2952BE730`;

-- DropForeignKey
ALTER TABLE `pg_planilla_extra_empleado` DROP FOREIGN KEY `FK_F9A77EA2CC04A73E`;

-- DropForeignKey
ALTER TABLE `pg_planilla_extra_empleado` DROP FOREIGN KEY `FK_F9A77EA2EF34C0BD`;

-- DropForeignKey
ALTER TABLE `pg_planilla_extra_empleado` DROP FOREIGN KEY `FK_F9A77EA2F747F090`;

-- DropForeignKey
ALTER TABLE `pg_turno_excepcion` DROP FOREIGN KEY `FK_9DAD81FEF4C2234D`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B871114FAA7C`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B87128F0D5CA`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B8712BAEF284`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B87155CD1AE4`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B8715EEC5E1B`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B87179F98940`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B8718D7C55D2`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B8719297142`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B871996BD967`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B871AB8DC0F8`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B871B0B41592`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B871B7B147D6`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B871CC04A73E`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B871D2624C39`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B871ED33694C`;

-- DropForeignKey
ALTER TABLE `s_empleado` DROP FOREIGN KEY `FK_EFE4B871FCBB0AEC`;

-- DropForeignKey
ALTER TABLE `s_empleado_plaza` DROP FOREIGN KEY `FK_79220E13EF34C0BD`;

-- DropForeignKey
ALTER TABLE `s_planilla` DROP FOREIGN KEY `FK_A2ED8530521E1991`;

-- DropForeignKey
ALTER TABLE `security_fos_user` DROP FOREIGN KEY `FK_F611E3AB5CAEAC5D`;

-- DropForeignKey
ALTER TABLE `security_fos_user` DROP FOREIGN KEY `FK_F611E3AB81B56B3`;

-- DropForeignKey
ALTER TABLE `security_fos_user` DROP FOREIGN KEY `FK_F611E3ABE4517BDD`;

-- DropForeignKey
ALTER TABLE `security_fos_users_divisiones` DROP FOREIGN KEY `FK_ECB7EF6390B45A1C`;

-- DropForeignKey
ALTER TABLE `security_fos_users_divisiones` DROP FOREIGN KEY `FK_ECB7EF63A76ED395`;

-- DropForeignKey
ALTER TABLE `security_fos_users_groups` DROP FOREIGN KEY `FK_195E7B04A76ED395`;

-- DropForeignKey
ALTER TABLE `security_fos_users_groups` DROP FOREIGN KEY `FK_195E7B04FE54D947`;

-- DropForeignKey
ALTER TABLE `security_fos_users_roles_monitoreo` DROP FOREIGN KEY `FK_6B6023C2A76ED395`;

-- DropForeignKey
ALTER TABLE `security_fos_users_roles_monitoreo` DROP FOREIGN KEY `FK_6B6023C2CECCB70E`;

-- DropForeignKey
ALTER TABLE `security_fos_users_roles_tipoaccion` DROP FOREIGN KEY `FK_D81D1251A76ED395`;

-- DropForeignKey
ALTER TABLE `security_fos_users_roles_tipoaccion` DROP FOREIGN KEY `FK_D81D1251C9F2F869`;

-- DropForeignKey
ALTER TABLE `v_planilla_aguinaldo` DROP FOREIGN KEY `FK_349B745C521E1991`;

-- DropForeignKey
ALTER TABLE `v_planilla_aguinaldo_empleado` DROP FOREIGN KEY `FK_3941B047952BE730`;

-- DropForeignKey
ALTER TABLE `v_planilla_aguinaldo_empleado` DROP FOREIGN KEY `FK_3941B047D45EF842`;

-- DropForeignKey
ALTER TABLE `v_salario_mes` DROP FOREIGN KEY `FK_E9F02E60952BE730`;

-- DropForeignKey
ALTER TABLE `v_salario_mes` DROP FOREIGN KEY `FK_E9F02E60ACF1D1A2`;

-- DropForeignKey
ALTER TABLE `v_vacacion_empleado` DROP FOREIGN KEY `FK_50A3975A952BE730`;

-- DropForeignKey
ALTER TABLE `v_vacacion_mes` DROP FOREIGN KEY `FK_5B04062661CD3BE2`;

-- DropForeignKey
ALTER TABLE `v_vacacion_solicitud` DROP FOREIGN KEY `FK_98808EDA6D3EA93A`;

-- DropForeignKey
ALTER TABLE `v_vacacion_solicitud` DROP FOREIGN KEY `FK_98808EDA7F5F4055`;

-- DropForeignKey
ALTER TABLE `v_vacacion_solicitud` DROP FOREIGN KEY `FK_98808EDA81B56B3`;

-- DropForeignKey
ALTER TABLE `v_vacacion_solicitud` DROP FOREIGN KEY `FK_98808EDA952BE730`;

-- DropForeignKey
ALTER TABLE `v_vacacion_solicitud` DROP FOREIGN KEY `FK_98808EDAD2624C39`;

-- DropForeignKey
ALTER TABLE `v_vacacion_solicitud` DROP FOREIGN KEY `FK_98808EDAE4517BDD`;

-- DropForeignKey
ALTER TABLE `v_vacacion_solicitud` DROP FOREIGN KEY `FK_98808EDAEF34C0BD`;

-- DropIndex
DROP INDEX `IDX_C_HORAS_EMPLEADO` ON `c_horas_extras`;

-- AlterTable
ALTER TABLE `c_horas_extras` DROP COLUMN `empleado_id`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `empleadoId` INTEGER NOT NULL,
    MODIFY `fecha` DATETIME(3) NOT NULL,
    MODIFY `horas` DOUBLE NOT NULL,
    MODIFY `descripcion` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ext_log_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `origen` VARCHAR(191) NOT NULL,
    `mensaje` VARCHAR(191) NOT NULL,
    `nivel` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `log_horario_dia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `horaEntrada` DATETIME(3) NULL,
    `horaSalida` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `log_extra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_accion_personal_linea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `accionPersonalId` INTEGER NOT NULL,
    `detalle` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `log_accionpersonal_enlazada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `accionPersonalId` INTEGER NOT NULL,
    `referenciaId` INTEGER NULL,
    `descripcion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_traslado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `origen` VARCHAR(191) NOT NULL,
    `destino` VARCHAR(191) NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_articulo_uniforme_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `articulo` VARCHAR(191) NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `fechaEntrega` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_planilla_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `salario` DOUBLE NOT NULL,
    `periodo` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_bitacora_acciones_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `accion` VARCHAR(191) NOT NULL,
    `detalle` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'pendiente',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_accion_personal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `motivo` VARCHAR(191) NULL,
    `fecha` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `log_generico` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `modulo` VARCHAR(191) NOT NULL,
    `mensaje` VARCHAR(191) NOT NULL,
    `nivel` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `log_cambioguardia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `guardiaId` INTEGER NOT NULL,
    `turnoInicio` DATETIME(3) NOT NULL,
    `turnoFin` DATETIME(3) NOT NULL,
    `observacion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_marca_dia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `tipoMarca` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `a_recovery_password_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `expira_en` INTEGER NOT NULL,
    `creacion` DATETIME(0) NOT NULL,
    `token` VARCHAR(255) NOT NULL,

    INDEX `FK_E35A23BC952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `empleadoId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `refresh_token_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `a_recovery_password_token` ADD CONSTRAINT `FK_E35A23BC952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `a_recibo_pago` ADD CONSTRAINT `FK_23679AA8DE734E51` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `b_consecutivo_empresa_banco` ADD CONSTRAINT `FK_E8669A36521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `b_consecutivo_empresa_banco` ADD CONSTRAINT `FK_E8669A36CC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `b_pago_excluido` ADD CONSTRAINT `FK_E34A23BC952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_adendas` ADD CONSTRAINT `FK_C15A2329952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_adendas` ADD CONSTRAINT `FK_C15A2329A1C0A276` FOREIGN KEY (`apoderado_id`) REFERENCES `n_apoderado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_articulo_uniforme_plaza` ADD CONSTRAINT `FK_9F3A46B04591C704` FOREIGN KEY (`articuloUniforme_id`) REFERENCES `n_articulo_uniforme`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_articulo_uniforme_plaza` ADD CONSTRAINT `FK_9F3A46B0EB6587E3` FOREIGN KEY (`combo_id`) REFERENCES `c_combo_uniforme_plaza`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_baja` ADD CONSTRAINT `FK_F87CC83189D8089F` FOREIGN KEY (`preaviso_id`) REFERENCES `c_preaviso`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_baja__n_motivo_no_recontratable` ADD CONSTRAINT `FK_4E7270C72DDF1AAA` FOREIGN KEY (`cbaja_id`) REFERENCES `c_baja`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_baja__n_motivo_no_recontratable` ADD CONSTRAINT `FK_4E7270C73F43B690` FOREIGN KEY (`nmotivonorecontratable_id`) REFERENCES `n_motivo_no_recontratable`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_bonificacion_turno` ADD CONSTRAINT `FK_1F8A4D4970AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_bonificacion_turno` ADD CONSTRAINT `FK_1F8A4D49ED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_bonificaciones` ADD CONSTRAINT `FK_3DBD73D9952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F043315ABD58` FOREIGN KEY (`marcaDiaReemplaza_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F04334558C79` FOREIGN KEY (`accionPersonal_id`) REFERENCES `c_accion_personal`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F04335FB34B5B` FOREIGN KEY (`marcaDiaAusente_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F043360ACC8FA` FOREIGN KEY (`plazaAusente_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F043375F636ED` FOREIGN KEY (`empleadoAusente_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F043381B56B3` FOREIGN KEY (`coordinadoPor_id`) REFERENCES `n_coordinado_por`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F04339D7193A2` FOREIGN KEY (`empleadoReemplaza_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F0433C2F7DD75` FOREIGN KEY (`plazaReemplaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F0433E4517BDD` FOREIGN KEY (`coordinador_id`) REFERENCES `n_coordinador`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_horario` ADD CONSTRAINT `FK_E6A5B2C1186B3418` FOREIGN KEY (`horarioInicial_id`) REFERENCES `c_horario`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_horario` ADD CONSTRAINT `FK_E6A5B2C16E94741B` FOREIGN KEY (`horarioFinal_id`) REFERENCES `c_horario`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_horario` ADD CONSTRAINT `FK_E6A5B2C1AF8A0D2D` FOREIGN KEY (`categoriaSalarialInicial_id`) REFERENCES `pg_categoria_salarial`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_horario` ADD CONSTRAINT `FK_E6A5B2C1B8F00EA0` FOREIGN KEY (`categoriaSalarialFinal_id`) REFERENCES `pg_categoria_salarial`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_periodo_pago` ADD CONSTRAINT `FK_C869871ABB712BEE` FOREIGN KEY (`periodoPagoInicial_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_cambio_periodo_pago` ADD CONSTRAINT `FK_C869871ACD4171BE` FOREIGN KEY (`periodoPagoFinal_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_curso_empleado` ADD CONSTRAINT `FK_EF09AA1287CB4A1F` FOREIGN KEY (`curso_id`) REFERENCES `c_curso`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_curso_empleado` ADD CONSTRAINT `FK_EF09AA12952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_deudas` ADD CONSTRAINT `FK_8AB91D2C6C9408BE` FOREIGN KEY (`tipoDeudas_id`) REFERENCES `n_tipo_deuda`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_deudas` ADD CONSTRAINT `FK_8AB91D2C952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_embargos_judiciales` ADD CONSTRAINT `FK_68326432C5CAD3D1` FOREIGN KEY (`deuda_id`) REFERENCES `c_deudas`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_embargos_pension_alimentaria` ADD CONSTRAINT `FK_B2678676C5CAD3D1` FOREIGN KEY (`deuda_id`) REFERENCES `c_deudas`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999114FAA7C` FOREIGN KEY (`educacionTecnico_id`) REFERENCES `n_educacion_tecnico`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A399919E9AC5F` FOREIGN KEY (`supervisor_id`) REFERENCES `n_ejecutivo_cuenta`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A39991CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A399928F0D5CA` FOREIGN KEY (`escolaridad_id`) REFERENCES `n_escolaridad`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A39992BAEF284` FOREIGN KEY (`estadoCivil_id`) REFERENCES `n_estado_civil`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A399955CD1AE4` FOREIGN KEY (`educacionUniversidad_id`) REFERENCES `n_educacion_universidad`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A39995EEC5E1B` FOREIGN KEY (`educacionPrimaria_id`) REFERENCES `n_educacion_primaria`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A39996EA899DA` FOREIGN KEY (`plazaEmpleado_id`) REFERENCES `c_empleado_plaza`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A399979F98940` FOREIGN KEY (`seguroCaja_id`) REFERENCES `n_seguro_caja`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A39998D7C55D2` FOREIGN KEY (`sindicato_id`) REFERENCES `n_sindicato`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999996BD967` FOREIGN KEY (`educacionSecundaria_id`) REFERENCES `n_educacion_secundaria`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999A07740F` FOREIGN KEY (`comboUniforme_id`) REFERENCES `c_combo_uniforme_plaza`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999AB8DC0F8` FOREIGN KEY (`nacionalidad_id`) REFERENCES `n_nacionalidad`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999B0B41592` FOREIGN KEY (`tipoContratacion_id`) REFERENCES `n_tipo_contratacion`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999CC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999D2624C39` FOREIGN KEY (`periodoPago_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999ED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999FCBB0AEC` FOREIGN KEY (`tipoPagoCasa_id`) REFERENCES `n_tipo_pago_casa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `refresh_token` ADD CONSTRAINT `refresh_token_empleadoId_fkey` FOREIGN KEY (`empleadoId`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_empleado_basedatos_digital` ADD CONSTRAINT `FK_9BF4295A1CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_basedatos_digital` ADD CONSTRAINT `FK_9BF4295A952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_datos_adjuntos_rrhh` ADD CONSTRAINT `FK_FE891195A2DE568` FOREIGN KEY (`tipoDatoAdjunto_id`) REFERENCES `n_tipo_dato_adjunto_rrhh`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_datos_adjuntos_rrhh` ADD CONSTRAINT `FK_FE89119952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_gasto_principal` ADD CONSTRAINT `FK_6136C13518864C8` FOREIGN KEY (`egastoprincipal_id`) REFERENCES `e_gasto_principal`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_gasto_principal` ADD CONSTRAINT `FK_6136C13DAB52E4B` FOREIGN KEY (`cempleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D3C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D41859289` FOREIGN KEY (`division_id`) REFERENCES `n_division`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D4959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D5035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D5CAEAC5D` FOREIGN KEY (`ejecutivoCuenta_id`) REFERENCES `n_ejecutivo_cuenta`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D70AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308DDE734E51` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308DEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_referencias` ADD CONSTRAINT `FK_E5ADCE2D1CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_referencias` ADD CONSTRAINT `FK_E5ADCE2D2BAEF284` FOREIGN KEY (`estadoCivil_id`) REFERENCES `n_estado_civil`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_referencias` ADD CONSTRAINT `FK_E5ADCE2D952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_referencias` ADD CONSTRAINT `FK_E5ADCE2DD3F1ED37` FOREIGN KEY (`clasificacionReferencia_id`) REFERENCES `n_clasificacion_referencia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_registro_laboral` ADD CONSTRAINT `FK_30CD41E5952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_registro_laboral` ADD CONSTRAINT `FK_30CD41E5AC3051D` FOREIGN KEY (`tipoRegistroLaboral_id`) REFERENCES `n_tipo_registro_laboral`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_sindicato` ADD CONSTRAINT `FK_7F8A7D598D7C55D2` FOREIGN KEY (`sindicato_id`) REFERENCES `n_sindicato`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_sindicato` ADD CONSTRAINT `FK_7F8A7D59952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_sindicato_adjuntos` ADD CONSTRAINT `FK_2CD97FCF6F9D0169` FOREIGN KEY (`empleado_sindicato_id`) REFERENCES `c_empleado_sindicato`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_empleado_tramite_portacion_arma` ADD CONSTRAINT `FK_E46810F952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_extra_limite_semanal` ADD CONSTRAINT `FK_A0512A95952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_extra_tarifa_corpo` ADD CONSTRAINT `FK_E3FAC1FB279A5D5E` FOREIGN KEY (`sucursal_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_extra_tarifa_corpo` ADD CONSTRAINT `FK_E3FAC1FB3AD4FFE2` FOREIGN KEY (`cextratarifa_id`) REFERENCES `c_extra_tarifa`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_extra_tarifa_rango` ADD CONSTRAINT `FK_4E1AD678ED0E28FB` FOREIGN KEY (`extraTarifa_id`) REFERENCES `c_extra_tarifa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_fecha_excepcional` ADD CONSTRAINT `FK_403BB7FF4959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_fecha_excepcional` ADD CONSTRAINT `FK_403BB7FF952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_feriado_dia` ADD CONSTRAINT `FK_9B00E14AB1C52DFC` FOREIGN KEY (`feriadoCalendario_id`) REFERENCES `c_feriado_calendario`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_horario_dia` ADD CONSTRAINT `FK_E719D4BD4959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_horario_dia` ADD CONSTRAINT `FK_E719D4BDEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_incapacidad_ins` ADD CONSTRAINT `FK_80539B87521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_incapacidad_ins` ADD CONSTRAINT `FK_80539B87DE78DC57` FOREIGN KEY (`empresaPoliza_id`) REFERENCES `n_empresa_poliza`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_induccion` ADD CONSTRAINT `FK_371730A5035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_induccion` ADD CONSTRAINT `FK_371730A952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_induccion_dia` ADD CONSTRAINT `FK_E5590D543CEEDC64` FOREIGN KEY (`induccion_id`) REFERENCES `c_induccion`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_induccion_dia` ADD CONSTRAINT `FK_E5590D547963DFC5` FOREIGN KEY (`marcaDia_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_induccion_dia` ADD CONSTRAINT `FK_E5590D54EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E62B959FC6` FOREIGN KEY (`extra_id`) REFERENCES `c_horas_extras`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E663ED981F` FOREIGN KEY (`marcaDiaOrigen_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E681B56B3` FOREIGN KEY (`coordinadoPor_id`) REFERENCES `n_coordinado_por`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E68C1B0AEB` FOREIGN KEY (`marcaDiaDestino_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E6952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E6A65E775D` FOREIGN KEY (`empleadoDestino_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E6B304894A` FOREIGN KEY (`plazaDestino_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E6C968E4B9` FOREIGN KEY (`plazaOrigen_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E6E4517BDD` FOREIGN KEY (`coordinador_id`) REFERENCES `n_coordinador`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_intercambio_linea` ADD CONSTRAINT `FK_88E784CE4BC37A6F` FOREIGN KEY (`intercambio_id`) REFERENCES `c_intercambio`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_intercambio_linea` ADD CONSTRAINT `FK_88E784CE77BB7125` FOREIGN KEY (`plazaInicio_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_intercambio_linea` ADD CONSTRAINT `FK_88E784CE952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_intercambio_linea` ADD CONSTRAINT `FK_88E784CEAED3850` FOREIGN KEY (`plazaFin_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_intercambio_linea` ADD CONSTRAINT `FK_88E784CEF883EFAA` FOREIGN KEY (`empleadoSustituido_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_roltipoaccion_tipoaccion` ADD CONSTRAINT `FK_48CD1A52C9F2F869` FOREIGN KEY (`croltipoaccion_id`) REFERENCES `c_rol_tipoaccion`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_roltipoaccion_tipoaccion` ADD CONSTRAINT `FK_48CD1A52E93DD86B` FOREIGN KEY (`ctipoaccion_id`) REFERENCES `c_tipo_accion`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_separacion_temp` ADD CONSTRAINT `FK_540A8D7C9F59AD70` FOREIGN KEY (`empleadoTrasladoTemp_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C018586848` FOREIGN KEY (`tipoPortacionArmas_id`) REFERENCES `n_tipo_carnet_portacion`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C02BAEF284` FOREIGN KEY (`estadoCivil_id`) REFERENCES `n_estado_civil`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C041859289` FOREIGN KEY (`division_id`) REFERENCES `n_division`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C04E7121AF` FOREIGN KEY (`provincia_id`) REFERENCES `n_provincia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C06AC7D228` FOREIGN KEY (`terceraOpcionTrabajar_id`) REFERENCES `n_provincia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C08B34DB71` FOREIGN KEY (`vacante_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C08D070D0B` FOREIGN KEY (`canton_id`) REFERENCES `n_canton`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C08E099F24` FOREIGN KEY (`primeraOpcionTrabajar_id`) REFERENCES `n_provincia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C098260155` FOREIGN KEY (`region_id`) REFERENCES `n_region`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C0AB8DC0F8` FOREIGN KEY (`nacionalidad_id`) REFERENCES `n_nacionalidad`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C0B894E495` FOREIGN KEY (`segundaOpcionTrabajar_id`) REFERENCES `n_provincia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C0E557397E` FOREIGN KEY (`distrito_id`) REFERENCES `n_distrito`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo_adjunto` ADD CONSTRAINT `FK_55893DCD1CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitudempleo__n_idioma` ADD CONSTRAINT `FK_38D7303214714E0A` FOREIGN KEY (`nidioma_id`) REFERENCES `n_idioma`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_solicitudempleo__n_idioma` ADD CONSTRAINT `FK_38D730324248037D` FOREIGN KEY (`csolicitudempleo_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_tramite_portacion_arma` ADD CONSTRAINT `FK_B71936626D892826` FOREIGN KEY (`empleadoTramitePortacionArma_id`) REFERENCES `c_empleado_tramite_portacion_arma`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_traslado_temp` ADD CONSTRAINT `FK_7B0E282C1B482BBB` FOREIGN KEY (`plazaInicial_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consultor_actualizacion` ADD CONSTRAINT `FK_A7D941FB4E7121AF` FOREIGN KEY (`provincia_id`) REFERENCES `n_provincia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consultor_actualizacion` ADD CONSTRAINT `FK_A7D941FB8D070D0B` FOREIGN KEY (`canton_id`) REFERENCES `n_canton`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consultor_actualizacion` ADD CONSTRAINT `FK_A7D941FB952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consultor_actualizacion` ADD CONSTRAINT `FK_A7D941FBE557397E` FOREIGN KEY (`distrito_id`) REFERENCES `n_distrito`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consultor_actualizacion_telefonos` ADD CONSTRAINT `FK_2CF2054CDF01D38` FOREIGN KEY (`actualizacion_id`) REFERENCES `consultor_actualizacion`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consultor_history_checked_update` ADD CONSTRAINT `FK_37A84590952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consultor_log` ADD CONSTRAINT `FK_45A0E79B1CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `v_vacacion_solicitud`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consultor_log` ADD CONSTRAINT `FK_45A0E79B952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `d_empleado_cartas_recomendacion` ADD CONSTRAINT `FK_244336C1CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `d_empleado_cartas_recomendacion` ADD CONSTRAINT `FK_244336C952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `d_empleado_hoja_delincuencia` ADD CONSTRAINT `FK_D39F3EAF1CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `d_empleado_hoja_delincuencia` ADD CONSTRAINT `FK_D39F3EAF952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `d_empleado_otras_anotaciones` ADD CONSTRAINT `FK_CAA044011CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `d_empleado_otras_anotaciones` ADD CONSTRAINT `FK_CAA04401952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_antecedente_penal` ADD CONSTRAINT `FK_47E60268952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_cuenta_banco_empleado` ADD CONSTRAINT `FK_DBE7C3CB952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_cuenta_banco_empleado` ADD CONSTRAINT `FK_DBE7C3CBCC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_cursos` ADD CONSTRAINT `FK_2B0E1353952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_dato_legal` ADD CONSTRAINT `FK_3E0AEB71952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_domicilio` ADD CONSTRAINT `FK_7F866C2C952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_domicilio` ADD CONSTRAINT `FK_7F866C2C98260155` FOREIGN KEY (`region_id`) REFERENCES `n_region`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_domicilio` ADD CONSTRAINT `FK_7F866C2CE557397E` FOREIGN KEY (`distrito_id`) REFERENCES `n_distrito`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_educacion` ADD CONSTRAINT `FK_F2D67309952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_educacion_idiomas` ADD CONSTRAINT `FK_52B18791952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_educacion_idiomas` ADD CONSTRAINT `FK_52B18791DEDC0611` FOREIGN KEY (`idioma_id`) REFERENCES `n_idioma`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_empleado_incumplimiento` ADD CONSTRAINT `FK_7D24EC63952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_empleado_incumplimiento` ADD CONSTRAINT `FK_7D24EC63B0DCC882` FOREIGN KEY (`tipoSancionAplicada_id`) REFERENCES `n_tipo_sancion`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_empleado_incumplimiento` ADD CONSTRAINT `FK_7D24EC63F88683D9` FOREIGN KEY (`accionBaja_id`) REFERENCES `c_accion_personal`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_empleado_incumplimiento__n_motivo` ADD CONSTRAINT `FK_A8E899CD37734155` FOREIGN KEY (`eincumplimiento_id`) REFERENCES `e_empleado_incumplimiento`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_empleado_incumplimiento__n_motivo` ADD CONSTRAINT `FK_A8E899CD517A96A9` FOREIGN KEY (`nmotivoincumplimiento_id`) REFERENCES `n_motivo_incumplimiento`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_empleado_incumplimiento_accion` ADD CONSTRAINT `FK_5FD78332170286C` FOREIGN KEY (`caccionpersonal_id`) REFERENCES `c_accion_personal`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_empleado_incumplimiento_accion` ADD CONSTRAINT `FK_5FD783337734155` FOREIGN KEY (`eincumplimiento_id`) REFERENCES `e_empleado_incumplimiento`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_empleado_lista_negra` ADD CONSTRAINT `FK_69D24DF1279A5D5E` FOREIGN KEY (`sucursal_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_empleado_lista_negra` ADD CONSTRAINT `FK_69D24DF1952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_empleado_lista_negra` ADD CONSTRAINT `FK_69D24DF1DE734E51` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_entrega` ADD CONSTRAINT `FK_9BAD26993C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_entrega` ADD CONSTRAINT `FK_9BAD26995035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_entrega` ADD CONSTRAINT `FK_9BAD269985828A9B` FOREIGN KEY (`nomencladorArticuloCP_id`) REFERENCES `n_articulo_corpo_puesto`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` ADD CONSTRAINT `FK_AAD537C43C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` ADD CONSTRAINT `FK_AAD537C45035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` ADD CONSTRAINT `FK_AAD537C4EB6587E3` FOREIGN KEY (`combo_id`) REFERENCES `e_estructura_combo_articulo_cp`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` ADD CONSTRAINT `FK_AAD537C4EDDDC6B` FOREIGN KEY (`articuloCP_id`) REFERENCES `n_articulo_corpo_puesto`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_bonificaciones_plaza` ADD CONSTRAINT `FK_89391A8D86CE56DC` FOREIGN KEY (`bonificacion_id`) REFERENCES `n_bonificacion_plaza`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_bonificaciones_plaza` ADD CONSTRAINT `FK_89391A8DEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_cliente` ADD CONSTRAINT `FK_AE021871521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_cliente_usuario` ADD CONSTRAINT `FK_E039927BA76ED395` FOREIGN KEY (`user_id`) REFERENCES `security_fos_user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_cliente_usuario` ADD CONSTRAINT `FK_E039927BDE734E51` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_contrato` ADD CONSTRAINT `FK_A35EE4D41859289` FOREIGN KEY (`division_id`) REFERENCES `n_division`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_contrato` ADD CONSTRAINT `FK_A35EE4D4FF0676` FOREIGN KEY (`tipoContrato_id`) REFERENCES `n_tipo_contrato`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_contrato` ADD CONSTRAINT `FK_A35EE4D521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_contrato` ADD CONSTRAINT `FK_A35EE4D76490E74` FOREIGN KEY (`lugarApertura_id`) REFERENCES `n_lugar_apertura`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_contrato` ADD CONSTRAINT `FK_A35EE4DDE734E51` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_curso_contrato` ADD CONSTRAINT `FK_93FF31DC70AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_curso_contrato` ADD CONSTRAINT `FK_93FF31DC87CB4A1F` FOREIGN KEY (`curso_id`) REFERENCES `c_curso`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_dia_excepcion_plaza` ADD CONSTRAINT `FK_640C22F132838645` FOREIGN KEY (`diaExcepcionPuesto_id`) REFERENCES `e_estructura_dia_excepcion_puesto`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_dia_excepcion_plaza` ADD CONSTRAINT `FK_640C22F17963DFC5` FOREIGN KEY (`marcaDia_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_dia_excepcion_plaza` ADD CONSTRAINT `FK_640C22F1EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_dia_excepcion_puesto` ADD CONSTRAINT `FK_1F27E2D35035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_empleado_autorizado_contrato` ADD CONSTRAINT `FK_8E302ED270AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_empleado_autorizado_contrato` ADD CONSTRAINT `FK_8E302ED2952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_historico_contrato` ADD CONSTRAINT `FK_688D970F70AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_historico_contrato` ADD CONSTRAINT `FK_688D970F84F63C81` FOREIGN KEY (`tipoRegistroContrato_id`) REFERENCES `n_tipo_registro_contrato`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_horario_plaza_historial` ADD CONSTRAINT `FK_F4AAD92F4959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_horario_plaza_historial` ADD CONSTRAINT `FK_F4AAD92FEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_horariopuesto_dia` ADD CONSTRAINT `FK_2968410A4959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `e_estructura_horariopuesto`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_plazas` ADD CONSTRAINT `FK_92687E504BAB96C` FOREIGN KEY (`rol_id`) REFERENCES `c_horario`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_plazas` ADD CONSTRAINT `FK_92687E505035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_plazas` ADD CONSTRAINT `FK_92687E5066A839D6` FOREIGN KEY (`empleadoPlaza_id`) REFERENCES `c_empleado_plaza`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_plazas` ADD CONSTRAINT `FK_92687E50A07740F` FOREIGN KEY (`comboUniforme_id`) REFERENCES `c_combo_uniforme_plaza`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_plazas` ADD CONSTRAINT `FK_92687E50F4C2234D` FOREIGN KEY (`categoriaSalarial_id`) REFERENCES `pg_categoria_salarial`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_puesto` ADD CONSTRAINT `FK_5C9F9D20279A5D5E` FOREIGN KEY (`sucursal_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_puesto` ADD CONSTRAINT `FK_5C9F9D202AC174D0` FOREIGN KEY (`tipoPuesto_id`) REFERENCES `n_tipo_puesto`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_puesto` ADD CONSTRAINT `FK_5C9F9D207A17505D` FOREIGN KEY (`comboArticulosCP_id`) REFERENCES `e_estructura_combo_articulo_cp`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_puesto` ADD CONSTRAINT `FK_5C9F9D209FF23C2C` FOREIGN KEY (`horarioPuesto_id`) REFERENCES `e_estructura_horariopuesto`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_puesto` ADD CONSTRAINT `FK_5C9F9D20EB6A1B22` FOREIGN KEY (`tipoHoraExtra_id`) REFERENCES `n_horas_extras`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_requerimiento_contrato` ADD CONSTRAINT `FK_D5DEDC5251DD0900` FOREIGN KEY (`requerimiento_id`) REFERENCES `n_requerimiento`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_requerimiento_contrato` ADD CONSTRAINT `FK_D5DEDC5270AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E6384E7121AF` FOREIGN KEY (`provincia_id`) REFERENCES `n_provincia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E6385CAEAC5D` FOREIGN KEY (`ejecutivoCuenta_id`) REFERENCES `n_ejecutivo_cuenta`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E63870AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E6387A17505D` FOREIGN KEY (`comboArticulosCP_id`) REFERENCES `e_estructura_combo_articulo_cp`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E6388D070D0B` FOREIGN KEY (`canton_id`) REFERENCES `n_canton`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E63898260155` FOREIGN KEY (`region_id`) REFERENCES `n_region`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E638E557397E` FOREIGN KEY (`distrito_id`) REFERENCES `n_distrito`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_familia` ADD CONSTRAINT `FK_BFFE2C1E5BA311FC` FOREIGN KEY (`parentesco_id`) REFERENCES `n_parentesco`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_familia` ADD CONSTRAINT `FK_BFFE2C1E952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_familia` ADD CONSTRAINT `FK_BFFE2C1ED8999C67` FOREIGN KEY (`ocupacion_id`) REFERENCES `n_ocupacion`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_historia_salud` ADD CONSTRAINT `FK_DBC9ED35952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_historia_salud_deportes` ADD CONSTRAINT `FK_C8CA2E312AC5252B` FOREIGN KEY (`ehistoriasalud_id`) REFERENCES `e_historia_salud`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_historia_salud_deportes` ADD CONSTRAINT `FK_C8CA2E31CE01478D` FOREIGN KEY (`ndeportes_id`) REFERENCES `n_deportes`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_historia_salud_juego_azar` ADD CONSTRAINT `FK_A5E83ADC2AC5252B` FOREIGN KEY (`ehistoriasalud_id`) REFERENCES `e_historia_salud`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_historia_salud_juego_azar` ADD CONSTRAINT `FK_A5E83ADCCB6A38C4` FOREIGN KEY (`njuegoazar_id`) REFERENCES `n_juego_azar`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_historia_salud_tipo_enfermedad` ADD CONSTRAINT `FK_68A643A55E542676` FOREIGN KEY (`tipoEnfermedad_id`) REFERENCES `n_tipo_enfermedad`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_historia_salud_tipo_enfermedad` ADD CONSTRAINT `FK_68A643A571AC4617` FOREIGN KEY (`historiaSalud_id`) REFERENCES `e_historia_salud`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_historia_trabajo` ADD CONSTRAINT `FK_C3C4D66952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_informacion_educacional` ADD CONSTRAINT `FK_4ECC8A5654204EE1` FOREIGN KEY (`nivelEducacional_id`) REFERENCES `n_nivel_educacional`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_informacion_educacional` ADD CONSTRAINT `FK_4ECC8A568ED81F31` FOREIGN KEY (`educacion_id`) REFERENCES `e_educacion`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_licencia` ADD CONSTRAINT `FK_209564874E5E27A4` FOREIGN KEY (`tipoLicencia_id`) REFERENCES `n_tipo_licencia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_licencia` ADD CONSTRAINT `FK_20956487952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_persona_dependen` ADD CONSTRAINT `FK_708D21555BA311FC` FOREIGN KEY (`parentesco_id`) REFERENCES `n_parentesco`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_persona_dependen` ADD CONSTRAINT `FK_708D2155952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_persona_dependen` ADD CONSTRAINT `FK_708D2155D8999C67` FOREIGN KEY (`ocupacion_id`) REFERENCES `n_ocupacion`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_persona_empresa` ADD CONSTRAINT `FK_61EEE3DCA57A8FE0` FOREIGN KEY (`otrosDatos_id`) REFERENCES `e_otros_datos`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_referencia_personal` ADD CONSTRAINT `FK_BFAFF6A4952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_registro_enfermedades` ADD CONSTRAINT `FK_946DE77A952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_registro_habilidades` ADD CONSTRAINT `FK_7BA0E6E9952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_requerimiento_cumplido` ADD CONSTRAINT `FK_BB503B1551DD0900` FOREIGN KEY (`requerimiento_id`) REFERENCES `n_requerimiento`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_requerimiento_cumplido` ADD CONSTRAINT `FK_BB503B15952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_trabajo` ADD CONSTRAINT `FK_1C41565B952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `e_trabajo` ADD CONSTRAINT `FK_1C41565BC2D4D747` FOREIGN KEY (`nombre_id`) REFERENCES `n_trabajo`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `log_horario` ADD CONSTRAINT `FK_DA956B344959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_comodin_ausente` ADD CONSTRAINT `FK_512A0FBD7963DFC5` FOREIGN KEY (`marcaDia_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_comodin_ausente` ADD CONSTRAINT `FK_512A0FBD952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_operacion` ADD CONSTRAINT `FK_8A9E6AF37963DFC5` FOREIGN KEY (`marcaDia_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_puesto_no_cubierto` ADD CONSTRAINT `FK_61ED78837963DFC5` FOREIGN KEY (`marcaDia_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_puesto_no_cubierto` ADD CONSTRAINT `FK_61ED7883952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_puesto_no_cubierto` ADD CONSTRAINT `FK_61ED7883C49D574A` FOREIGN KEY (`reposicionDeHoras_id`) REFERENCES `m_reposicion_de_horas`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_puesto_no_cubierto` ADD CONSTRAINT `FK_61ED7883EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_refuerzo` ADD CONSTRAINT `FK_E14C49FC2B959FC6` FOREIGN KEY (`extra_id`) REFERENCES `c_horas_extras`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_refuerzo` ADD CONSTRAINT `FK_E14C49FC3C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_refuerzo` ADD CONSTRAINT `FK_E14C49FC7963DFC5` FOREIGN KEY (`marcaDia_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_refuerzo` ADD CONSTRAINT `FK_E14C49FC952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_refuerzo` ADD CONSTRAINT `FK_E14C49FCEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_reposicion_de_horas` ADD CONSTRAINT `FK_35E7E0D45035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_reposicion_de_horas` ADD CONSTRAINT `FK_35E7E0D47963DFC5` FOREIGN KEY (`marcaDia_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_reposicion_de_horas` ADD CONSTRAINT `FK_35E7E0D4952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_rol_monitoreo_contrato` ADD CONSTRAINT `FK_98623F170AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_rol_monitoreo_contrato` ADD CONSTRAINT `FK_98623F1CECCB70E` FOREIGN KEY (`mrolmonitoreo_id`) REFERENCES `m_rol_monitoreo`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_rol_monitoreo_sucursal` ADD CONSTRAINT `FK_86732B84279A5D5E` FOREIGN KEY (`sucursal_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_rol_monitoreo_sucursal` ADD CONSTRAINT `FK_86732B84CECCB70E` FOREIGN KEY (`mrolmonitoreo_id`) REFERENCES `m_rol_monitoreo`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `m_turno_activo` ADD CONSTRAINT `FK_CC1DB0AE2F4E077F` FOREIGN KEY (`motivoMarcarHorarioPlaza_id`) REFERENCES `n_motivo_marcar_horario_plaza`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `n_apoderado` ADD CONSTRAINT `FK_2D844777952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `n_articulo_uniforme` ADD CONSTRAINT `FK_429432F081E7650` FOREIGN KEY (`tipoDeTalla_id`) REFERENCES `n_clasificacion_talla`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `n_canton` ADD CONSTRAINT `FK_9F82AC3C4E7121AF` FOREIGN KEY (`provincia_id`) REFERENCES `n_provincia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `n_coordinador` ADD CONSTRAINT `FK_D7D149E781B56B3` FOREIGN KEY (`coordinadoPor_id`) REFERENCES `n_coordinado_por`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `n_distrito` ADD CONSTRAINT `FK_5A4A14868D070D0B` FOREIGN KEY (`canton_id`) REFERENCES `n_canton`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `n_empresa_banco` ADD CONSTRAINT `FK_F5709BC0521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `n_empresa_banco` ADD CONSTRAINT `FK_F5709BC0CC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `n_empresa_poliza` ADD CONSTRAINT `FK_1223BAD041859289` FOREIGN KEY (`division_id`) REFERENCES `n_division`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `n_empresa_poliza` ADD CONSTRAINT `FK_1223BAD0521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `n_motivo_extra` ADD CONSTRAINT `FK_A3B0B86EB5523D4D` FOREIGN KEY (`tipoExtra_id`) REFERENCES `n_tipo_extra`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `n_pago_turno` ADD CONSTRAINT `FK_971CFF176065BC38` FOREIGN KEY (`categoriaPlaza_id`) REFERENCES `pg_categoria_salarial`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `n_pago_turno` ADD CONSTRAINT `FK_971CFF1769C5211E` FOREIGN KEY (`turno_id`) REFERENCES `n_turno`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `n_requerimiento` ADD CONSTRAINT `FK_529C438AB1D10646` FOREIGN KEY (`requerimiento_padre_id`) REFERENCES `n_requerimiento`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `p_periodopago` ADD CONSTRAINT `FK_31023814D035117` FOREIGN KEY (`periodoPagoConfig_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `p_planillas` ADD CONSTRAINT `FK_A4977423D2624C39` FOREIGN KEY (`periodoPago_id`) REFERENCES `p_periodopago`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `p_planillas_bonificaciones_pagadas` ADD CONSTRAINT `FK_12CD2767799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `p_planillas_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `p_planillas_bonificaciones_pagadas` ADD CONSTRAINT `FK_12CD276786CE56DC` FOREIGN KEY (`bonificacion_id`) REFERENCES `c_bonificaciones`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `p_planillas_bonificaciones_plaza_pagadas` ADD CONSTRAINT `FK_9F2F7DE7799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `p_planillas_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `p_planillas_bonificaciones_plaza_pagadas` ADD CONSTRAINT `FK_9F2F7DE7E084692E` FOREIGN KEY (`bonificacionPlaza_id`) REFERENCES `e_estructura_bonificaciones_plaza`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `p_planillas_deudas_pagadas` ADD CONSTRAINT `FK_A96F6365799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `p_planillas_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `p_planillas_deudas_pagadas` ADD CONSTRAINT `FK_A96F6365C5CAD3D1` FOREIGN KEY (`deuda_id`) REFERENCES `c_deudas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `p_planillas_dia_menos_descontado` ADD CONSTRAINT `FK_DBC74561799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `p_planillas_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `p_planillas_empleado` ADD CONSTRAINT `FK_CC9DC074952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `p_planillas_empleado` ADD CONSTRAINT `FK_CC9DC074F747F090` FOREIGN KEY (`planilla_id`) REFERENCES `p_planillas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_categoria_salarial` ADD CONSTRAINT `FK_E3A1F6CBED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_categoria_salarial_log` ADD CONSTRAINT `FK_5C4E2930ED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_categoria_salarial_log` ADD CONSTRAINT `FK_5C4E2930F4C2234D` FOREIGN KEY (`categoriaSalarial_id`) REFERENCES `pg_categoria_salarial`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pago_turno_semanal` ADD CONSTRAINT `FK_99D45AACED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pago_turno_semanal_log` ADD CONSTRAINT `FK_C845571FA0E9F09B` FOREIGN KEY (`pagoTurnoSemanal_id`) REFERENCES `pg_pago_turno_semanal`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pago_turno_semanal_log` ADD CONSTRAINT `FK_C845571FED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_bonif_empl_pagado` ADD CONSTRAINT `FK_1ED55932799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_bonif_empl_pagado` ADD CONSTRAINT `FK_1ED5593286CE56DC` FOREIGN KEY (`bonificacion_id`) REFERENCES `c_bonificaciones`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_bonif_plaza_pagado` ADD CONSTRAINT `FK_AB69EBC4799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_bonif_plaza_pagado` ADD CONSTRAINT `FK_AB69EBC486CE56DC` FOREIGN KEY (`bonificacion_id`) REFERENCES `e_estructura_bonificaciones_plaza`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_deuda_descontado` ADD CONSTRAINT `FK_8BF9D6E9799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_deuda_descontado` ADD CONSTRAINT `FK_8BF9D6E9C5CAD3D1` FOREIGN KEY (`deuda_id`) REFERENCES `c_deudas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_dia` ADD CONSTRAINT `FK_11D3EF533FBAC2B` FOREIGN KEY (`planillaEmpleadoRdh_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_dia` ADD CONSTRAINT `FK_11D3EF53436B53E8` FOREIGN KEY (`planillaEmpleadoCdg_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_dia` ADD CONSTRAINT `FK_11D3EF53799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_dia` ADD CONSTRAINT `FK_11D3EF53AC1F7597` FOREIGN KEY (`dia_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_feriado_dia_pagado` ADD CONSTRAINT `FK_EAF51CE1799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_feriado_dia_pagado` ADD CONSTRAINT `FK_EAF51CE1E2194A39` FOREIGN KEY (`feriadoDia_id`) REFERENCES `c_feriado_dia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_incapacidad_pagado` ADD CONSTRAINT `FK_FEB9C1B02EDBF996` FOREIGN KEY (`incapacidad_id`) REFERENCES `c_incapacidad_ccss`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_incapacidad_pagado` ADD CONSTRAINT `FK_FEB9C1B0799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_induccion_dia_pagado` ADD CONSTRAINT `FK_869A86811D6FE1F6` FOREIGN KEY (`induccionDia_id`) REFERENCES `c_inducciones`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_induccion_dia_pagado` ADD CONSTRAINT `FK_869A8681799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_rebajo_sindicato_pagado` ADD CONSTRAINT `FK_D0FCC65257F57AE7` FOREIGN KEY (`planilla_empleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_rebajo_sindicato_pagado` ADD CONSTRAINT `FK_D0FCC6526F9D0169` FOREIGN KEY (`empleado_sindicato_id`) REFERENCES `c_empleado_sindicato`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_refuerzo_dia_pagado` ADD CONSTRAINT `FK_C5D26D6632F8140A` FOREIGN KEY (`refuerzoDia_id`) REFERENCES `m_refuerzo`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_pe_refuerzo_dia_pagado` ADD CONSTRAINT `FK_C5D26D66799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95E10B18851` FOREIGN KEY (`accionPersonalLicenciaMaternidad_id`) REFERENCES `c_accion_personal`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95E3C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95E4558C79` FOREIGN KEY (`accionPersonal_id`) REFERENCES `c_accion_personal`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95E4959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95E70AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95E952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95EB1C7830E` FOREIGN KEY (`salarioMes_id`) REFERENCES `v_salario_mes`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95EEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95EF747F090` FOREIGN KEY (`planilla_id`) REFERENCES `pg_planilla`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra` ADD CONSTRAINT `FK_3764CFDF521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra` ADD CONSTRAINT `FK_3764CFDFCC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra_empleado` ADD CONSTRAINT `FK_F9A77EA2521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra_empleado` ADD CONSTRAINT `FK_F9A77EA2952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra_empleado` ADD CONSTRAINT `FK_F9A77EA2CC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra_empleado` ADD CONSTRAINT `FK_F9A77EA2EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra_empleado` ADD CONSTRAINT `FK_F9A77EA2F747F090` FOREIGN KEY (`planilla_id`) REFERENCES `pg_planilla_extra`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `pg_turno_excepcion` ADD CONSTRAINT `FK_9DAD81FEF4C2234D` FOREIGN KEY (`categoriaSalarial_id`) REFERENCES `pg_categoria_salarial`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871114FAA7C` FOREIGN KEY (`educacionTecnico_id`) REFERENCES `n_educacion_tecnico`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B87128F0D5CA` FOREIGN KEY (`escolaridad_id`) REFERENCES `n_escolaridad`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B8712BAEF284` FOREIGN KEY (`estadoCivil_id`) REFERENCES `n_estado_civil`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B87155CD1AE4` FOREIGN KEY (`educacionUniversidad_id`) REFERENCES `n_educacion_universidad`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B8715EEC5E1B` FOREIGN KEY (`educacionPrimaria_id`) REFERENCES `n_educacion_primaria`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B87179F98940` FOREIGN KEY (`seguroCaja_id`) REFERENCES `n_seguro_caja`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B8718D7C55D2` FOREIGN KEY (`sindicato_id`) REFERENCES `n_sindicato`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B8719297142` FOREIGN KEY (`empleadoAsociado_id`) REFERENCES `c_empleado`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871996BD967` FOREIGN KEY (`educacionSecundaria_id`) REFERENCES `n_educacion_secundaria`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871AB8DC0F8` FOREIGN KEY (`nacionalidad_id`) REFERENCES `n_nacionalidad`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871B0B41592` FOREIGN KEY (`tipoContratacion_id`) REFERENCES `n_tipo_contratacion`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871B7B147D6` FOREIGN KEY (`importacionEmpleados_id`) REFERENCES `s_importacion_empleados`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871CC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871D2624C39` FOREIGN KEY (`periodoPago_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871ED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871FCBB0AEC` FOREIGN KEY (`tipoPagoCasa_id`) REFERENCES `n_tipo_pago_casa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_empleado_plaza` ADD CONSTRAINT `FK_79220E13EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `s_planilla` ADD CONSTRAINT `FK_A2ED8530521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `security_fos_user` ADD CONSTRAINT `FK_F611E3AB5CAEAC5D` FOREIGN KEY (`ejecutivoCuenta_id`) REFERENCES `n_ejecutivo_cuenta`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `security_fos_user` ADD CONSTRAINT `FK_F611E3AB81B56B3` FOREIGN KEY (`coordinadoPor_id`) REFERENCES `n_coordinado_por`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `security_fos_user` ADD CONSTRAINT `FK_F611E3ABE4517BDD` FOREIGN KEY (`coordinador_id`) REFERENCES `n_coordinador`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `security_fos_users_divisiones` ADD CONSTRAINT `FK_ECB7EF6390B45A1C` FOREIGN KEY (`ndivision_id`) REFERENCES `n_division`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `security_fos_users_divisiones` ADD CONSTRAINT `FK_ECB7EF63A76ED395` FOREIGN KEY (`user_id`) REFERENCES `security_fos_user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `security_fos_users_groups` ADD CONSTRAINT `FK_195E7B04A76ED395` FOREIGN KEY (`user_id`) REFERENCES `security_fos_user`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `security_fos_users_groups` ADD CONSTRAINT `FK_195E7B04FE54D947` FOREIGN KEY (`group_id`) REFERENCES `security_fos_group`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `security_fos_users_roles_monitoreo` ADD CONSTRAINT `FK_6B6023C2A76ED395` FOREIGN KEY (`user_id`) REFERENCES `security_fos_user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `security_fos_users_roles_monitoreo` ADD CONSTRAINT `FK_6B6023C2CECCB70E` FOREIGN KEY (`mrolmonitoreo_id`) REFERENCES `m_rol_monitoreo`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `security_fos_users_roles_tipoaccion` ADD CONSTRAINT `FK_D81D1251A76ED395` FOREIGN KEY (`user_id`) REFERENCES `security_fos_user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `security_fos_users_roles_tipoaccion` ADD CONSTRAINT `FK_D81D1251C9F2F869` FOREIGN KEY (`croltipoaccion_id`) REFERENCES `c_rol_tipoaccion`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_planilla_aguinaldo` ADD CONSTRAINT `FK_349B745C521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_planilla_aguinaldo_empleado` ADD CONSTRAINT `FK_3941B047952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_planilla_aguinaldo_empleado` ADD CONSTRAINT `FK_3941B047D45EF842` FOREIGN KEY (`planillaAguinaldo_id`) REFERENCES `v_planilla_aguinaldo`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_salario_mes` ADD CONSTRAINT `FK_E9F02E60952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_salario_mes` ADD CONSTRAINT `FK_E9F02E60ACF1D1A2` FOREIGN KEY (`planillaAguinaldoEmpleado_id`) REFERENCES `v_planilla_aguinaldo_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_vacacion_empleado` ADD CONSTRAINT `FK_50A3975A952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_vacacion_mes` ADD CONSTRAINT `FK_5B04062661CD3BE2` FOREIGN KEY (`vacacionEmpleado_id`) REFERENCES `v_vacacion_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDA4558C79` FOREIGN KEY (`accionPersonal_id`) REFERENCES `c_accion_personal`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDA6D3EA93A` FOREIGN KEY (`sustituto_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDA7F5F4055` FOREIGN KEY (`motivoRechazo_id`) REFERENCES `n_motivo_rechazo_solicitud_vacacion`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDA81B56B3` FOREIGN KEY (`coordinadoPor_id`) REFERENCES `n_coordinado_por`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDA952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDAD2624C39` FOREIGN KEY (`periodoPago_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDAE4517BDD` FOREIGN KEY (`coordinador_id`) REFERENCES `n_coordinador`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDAEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
