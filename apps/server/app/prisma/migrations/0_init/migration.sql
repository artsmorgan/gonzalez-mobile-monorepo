-- CreateTable
CREATE TABLE `c_horas_extras` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` DATE NOT NULL,
    `descripcion` VARCHAR(254) NULL,
    `categoriaEmpleado_id` INTEGER NULL,
    `coeficiente_pago` DECIMAL(10, 2) NULL,
    `consecutivo` VARCHAR(15) NULL,
    `coordinadoPor_id` INTEGER NULL,
    `coordinador_id` INTEGER NULL,
    `doblaje` BOOLEAN NULL,
    `empleadoAusente_id` INTEGER NULL,
    `empleado_id` INTEGER NULL,
    `estado_aprobacion` VARCHAR(3) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `fecha_aprobado_ec` DATETIME(0) NULL,
    `fecha_aprobado_jo` DATETIME(0) NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `fecha_reversion` DATETIME(0) NULL,
    `formula_pago` LONGTEXT NULL,
    `hora_fin` TIME(0) NULL,
    `hora_inicio` TIME(0) NULL,
    `marcaDia_id` INTEGER NULL,
    `monto_comida` DECIMAL(10, 2) NULL,
    `monto_pagado_planilla` DECIMAL(10, 2) NULL,
    `motivoRechazo_id` INTEGER NULL,
    `motivo_id` INTEGER NULL,
    `motivo_reversion` VARCHAR(255) NULL,
    `observaciones_rechazo` VARCHAR(255) NULL,
    `operacion` BOOLEAN NULL,
    `periodoPago_id` INTEGER NULL,
    `planillaEmpleado_id` INTEGER NULL,
    `planillaExtraEmpleado_id` INTEGER NULL,
    `plaza_id` INTEGER NULL,
    `sindicato_id` INTEGER NULL,
    `tipoContratacion_id` INTEGER NULL,
    `tipo_comida` VARCHAR(3) NULL,
    `tipo_doblado` VARCHAR(150) NULL,
    `tipo_turno` VARCHAR(3) NULL,
    `tipo_turno_pagar` VARCHAR(3) NULL,
    `trabajando_libre` BOOLEAN NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `usuario_aprueba_ec` VARCHAR(50) NULL,
    `usuario_aprueba_jo` VARCHAR(50) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `usuario_reversion` VARCHAR(255) NULL,

    INDEX `IDX_3B30426475F636ED`(`empleadoAusente_id`),
    INDEX `IDX_3B3042647963DFC5`(`marcaDia_id`),
    INDEX `IDX_3B304264799EE823`(`planillaEmpleado_id`),
    INDEX `IDX_3B3042647F5F4055`(`motivoRechazo_id`),
    INDEX `IDX_3B30426481B56B3`(`coordinadoPor_id`),
    INDEX `IDX_3B3042648D7C55D2`(`sindicato_id`),
    INDEX `IDX_3B304264952BE730`(`empleado_id`),
    INDEX `IDX_3B304264B0B41592`(`tipoContratacion_id`),
    INDEX `IDX_3B304264CAA77C0D`(`planillaExtraEmpleado_id`),
    INDEX `IDX_3B304264D2624C39`(`periodoPago_id`),
    INDEX `IDX_3B304264E4517BDD`(`coordinador_id`),
    INDEX `IDX_3B304264ED33694C`(`categoriaEmpleado_id`),
    INDEX `IDX_3B304264EF34C0BD`(`plaza_id`),
    INDEX `IDX_3B304264F9E584F8`(`motivo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_accion_personal_linea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `accionPersonal_id` INTEGER NULL,
    `cantidad_horas` DECIMAL(5, 2) NULL,
    `fecha` DATE NOT NULL,
    `horario_str` VARCHAR(20) NULL,
    `monto_descontar_turno` DECIMAL(10, 2) NULL,
    `reemplazo_id` INTEGER NULL,
    `tipo_turno` VARCHAR(1) NULL,

    INDEX `IDX_54EA19084558C79`(`accionPersonal_id`),
    INDEX `IDX_54EA1908620C225E`(`reemplazo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_traslado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `datos_horario_plaza_final` LONGTEXT NULL,
    `datos_horario_plaza_inicial` LONGTEXT NULL,
    `motivo_oficial_sustituido` VARCHAR(255) NULL,
    `motivo_traslado` VARCHAR(20) NULL,
    `nombre_oficial_sustituido` VARCHAR(255) NULL,
    `observaciones_cambio_salario` VARCHAR(255) NULL,
    `observaciones_motivo_traslado` VARCHAR(255) NULL,
    `plazaInicial_id` INTEGER NULL,
    `traslado_sociedad` BOOLEAN NULL,

    INDEX `IDX_BEFF7AEC1B482BBB`(`plazaInicial_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_articulo_uniforme_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cantidad` INTEGER NOT NULL,
    `articuloUniforme_id` INTEGER NOT NULL,
    `cedula` VARCHAR(64) NULL,
    `consecutivo` INTEGER NOT NULL,
    `document` VARCHAR(255) NULL,
    `empleado_id` INTEGER NULL,
    `estado` INTEGER NOT NULL,
    `fecha_entrega` DATE NOT NULL,
    `talla` VARCHAR(10) NOT NULL,
    `tipo_entrega` INTEGER NULL,
    `updated_at` DATE NULL,
    `vence` DATE NOT NULL,

    INDEX `IDX_F0617B2F4591C704`(`articuloUniforme_id`),
    INDEX `IDX_F0617B2F952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_planilla_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anticipossalariales` DECIMAL(10, 2) NULL,
    `area` VARCHAR(100) NULL,
    `bonificacion_monto` DECIMAL(10, 2) NULL,
    `ccss` DECIMAL(10, 2) NULL,
    `cedula` VARCHAR(100) NULL,
    `codigo` VARCHAR(30) NULL,
    `contrato` VARCHAR(100) NULL,
    `corpo_sistema_segar` VARCHAR(255) NULL,
    `cuenta_banco_activa` BOOLEAN NULL,
    `diasordinarios_cantidad` DECIMAL(10, 2) NULL,
    `diasordinarios_monto` DECIMAL(10, 2) NULL,
    `dictamenmedico` DECIMAL(10, 2) NULL,
    `embargos` DECIMAL(10, 2) NULL,
    `empleado_id` INTEGER NULL,
    `examenpsicologico` DECIMAL(10, 2) NULL,
    `feriado_cantidad` DECIMAL(10, 2) NULL,
    `feriado_monto` DECIMAL(10, 2) NULL,
    `hed_cantidad` DECIMAL(10, 2) NULL,
    `hed_monto` DECIMAL(10, 2) NULL,
    `hem_cantidad` DECIMAL(10, 2) NULL,
    `hem_monto` DECIMAL(10, 2) NULL,
    `hen_cantidad` DECIMAL(10, 2) NULL,
    `hen_monto` DECIMAL(10, 2) NULL,
    `llegadastardias_horas` DECIMAL(10, 2) NULL,
    `llegadastardias_monto` DECIMAL(10, 2) NULL,
    `mail_notified_at` DATETIME(0) NULL,
    `monto_ccss` DECIMAL(10, 2) NULL,
    `monto_extras_33` DECIMAL(10, 2) NULL,
    `monto_licencia_maternidad` DECIMAL(10, 2) NULL,
    `nombre` VARCHAR(100) NULL,
    `numero_cuenta_banco` VARCHAR(50) NULL,
    `observaciones_comprobante` LONGTEXT NULL,
    `otrosrebajos` DECIMAL(10, 2) NULL,
    `pensionsalimenticia` DECIMAL(10, 2) NULL,
    `planilla_id` INTEGER NOT NULL,
    `puesto` VARCHAR(255) NULL,
    `rebajodanoequipo` DECIMAL(10, 2) NULL,
    `rebajofuneraria` DECIMAL(10, 2) NULL,
    `rebajoindicato` DECIMAL(10, 2) NULL,
    `rebajoprestamotercero` DECIMAL(10, 2) NULL,
    `rebajos` DECIMAL(10, 2) NULL,
    `rebajouniforme` DECIMAL(10, 2) NULL,
    `retencionesrenta` DECIMAL(10, 2) NULL,
    `salario_base_anterior` VARCHAR(50) NULL,
    `salario_base_nuevo` VARCHAR(50) NULL,
    `salario_bruto` DECIMAL(10, 2) NULL,
    `salario_diario` DECIMAL(10, 2) NULL,
    `salario_mensual_anterior` VARCHAR(50) NULL,
    `salario_mensual_nuevo` VARCHAR(50) NULL,
    `salario_neto` DECIMAL(10, 2) NULL,
    `subsidio_cantidad` DECIMAL(10, 2) NULL,
    `subsidio_monto` DECIMAL(10, 2) NULL,
    `total_retenciones` DECIMAL(10, 2) NULL,
    `vacacion_cantidad` DECIMAL(10, 2) NULL,
    `vacacion_monto` DECIMAL(10, 2) NULL,

    INDEX `IDX_F450C66C952BE730`(`empleado_id`),
    INDEX `IDX_F450C66CF747F090`(`planilla_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(0) NOT NULL,
    `args` LONGTEXT NOT NULL,
    `checkedAt` DATETIME(0) NULL,
    `closedAt` DATETIME(0) NULL,
    `command` VARCHAR(255) NOT NULL,
    `download_link` VARCHAR(255) NULL,
    `errorOutput` LONGTEXT NULL,
    `executeAfter` DATETIME(0) NULL,
    `exitCode` SMALLINT UNSIGNED NULL,
    `friendly_name` VARCHAR(80) NULL,
    `maxRetries` SMALLINT UNSIGNED NOT NULL,
    `maxRuntime` SMALLINT UNSIGNED NOT NULL,
    `output` LONGTEXT NULL,
    `priority` SMALLINT NOT NULL,
    `progress` INTEGER UNSIGNED NULL,
    `queue` VARCHAR(50) NOT NULL,
    `runtime` SMALLINT UNSIGNED NULL,
    `stackTrace` LONGBLOB NULL,
    `startedAt` DATETIME(0) NULL,
    `state` VARCHAR(15) NOT NULL,
    `user` VARCHAR(40) NULL,
    `workerName` VARCHAR(50) NULL,

    INDEX `cmd_search_index`(`command`),
    INDEX `sorting_index`(`state`, `priority`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_accion_personal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `accionGeneraSeparacion_id` INTEGER NULL,
    `aceptar_restricciones_reversion` BOOLEAN NULL,
    `adenda_id` INTEGER NULL,
    `ajuste_salario_id` INTEGER NULL,
    `ausencia_id` INTEGER NULL,
    `ausencia_transformada` BOOLEAN NULL,
    `baja_id` INTEGER NULL,
    `cambio_horario_id` INTEGER NULL,
    `cambio_periodo_pago_id` INTEGER NULL,
    `cantidad_horas` INTEGER NULL,
    `categoriaEmpleado_id` INTEGER NULL,
    `cliente_id` INTEGER NULL,
    `comentarios` VARCHAR(254) NULL,
    `consecutivo` VARCHAR(15) NULL,
    `contratacion_id` INTEGER NULL,
    `contrato_id` INTEGER NULL,
    `coordinadoPor_id` INTEGER NULL,
    `coordinador_id` INTEGER NULL,
    `corpo_id` INTEGER NULL,
    `document` VARCHAR(255) NULL,
    `empleado_id` INTEGER NULL,
    `empresa_id` INTEGER NULL,
    `estado_aprobacion` VARCHAR(3) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `fecha_aprobado_ec` DATETIME(0) NULL,
    `fecha_aprobado_jo` DATETIME(0) NULL,
    `fecha_fin` DATE NULL,
    `fecha_fin_traslado` DATE NULL,
    `fecha_inicio` DATE NOT NULL,
    `fecha_insercion` DATETIME(0) NOT NULL,
    `fecha_reversion` DATETIME(0) NULL,
    `fecha_sobrepuesto` DATETIME(0) NULL,
    `fecha_vence_justificar_ausencia` DATETIME(0) NULL,
    `fecha_vence_subir_adjunto` DATETIME(0) NULL,
    `horario_id` INTEGER NULL,
    `incapacidad_ccss_id` INTEGER NULL,
    `incapacidad_ins_id` INTEGER NULL,
    `libre_cubre_vacasiones_id` INTEGER NULL,
    `licencia_id` INTEGER NULL,
    `llegada_tardia_id` INTEGER NULL,
    `monto_descontar_turnos` DECIMAL(10, 2) NULL,
    `motivo_reversion` VARCHAR(254) NULL,
    `numero_hed` DECIMAL(10, 2) NULL,
    `numero_hem` DECIMAL(10, 2) NULL,
    `numero_hen` DECIMAL(10, 2) NULL,
    `operacion` BOOLEAN NULL,
    `periodoPago_id` INTEGER NULL,
    `permiso_con_goce_id` INTEGER NULL,
    `permiso_sin_goce_id` INTEGER NULL,
    `plaza_id` INTEGER NULL,
    `preaviso_id` INTEGER NULL,
    `puesto_id` INTEGER NULL,
    `reemplazo_id` INTEGER NULL,
    `reversible` BOOLEAN NULL,
    `salario` DECIMAL(10, 2) NOT NULL,
    `salario_base_diario` DECIMAL(10, 2) NULL,
    `salario_base_mensual` DECIMAL(10, 2) NULL,
    `salida_anticipada_id` INTEGER NULL,
    `separacion_temp_id` INTEGER NULL,
    `suspension_id` INTEGER NULL,
    `tipoAccion_id` INTEGER NULL,
    `tipoContratacion_id` INTEGER NULL,
    `traslado_id` INTEGER NULL,
    `traslado_temp_id` INTEGER NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `usuario_aprueba_ec` VARCHAR(50) NULL,
    `usuario_aprueba_jo` VARCHAR(50) NULL,
    `usuario_insercion` VARCHAR(255) NOT NULL,
    `usuario_reversion` VARCHAR(254) NULL,
    `vacacionMes_id` INTEGER NULL,
    `vacacion_disfrute_id` INTEGER NULL,
    `vacacion_pago_id` INTEGER NULL,

    UNIQUE INDEX `UNIQ_97D9ECEE43A913D8`(`accionGeneraSeparacion_id`),
    UNIQUE INDEX `UNIQ_97D9ECEE64E87FA9`(`adenda_id`),
    UNIQUE INDEX `UNIQ_97D9ECEEA61F9752`(`ajuste_salario_id`),
    UNIQUE INDEX `UNIQ_97D9ECEE60C93433`(`ausencia_id`),
    UNIQUE INDEX `UNIQ_97D9ECEE8BF5BDE5`(`baja_id`),
    UNIQUE INDEX `UNIQ_97D9ECEE3F0F0EAB`(`cambio_horario_id`),
    UNIQUE INDEX `UNIQ_97D9ECEECE18A6FD`(`cambio_periodo_pago_id`),
    UNIQUE INDEX `UNIQ_97D9ECEE68DBB923`(`contratacion_id`),
    UNIQUE INDEX `UNIQ_97D9ECEEE5C49C4`(`incapacidad_ccss_id`),
    UNIQUE INDEX `UNIQ_97D9ECEE175A33D1`(`incapacidad_ins_id`),
    UNIQUE INDEX `UNIQ_97D9ECEE6A6AE222`(`libre_cubre_vacasiones_id`),
    UNIQUE INDEX `UNIQ_97D9ECEE3A0F5A23`(`licencia_id`),
    UNIQUE INDEX `UNIQ_97D9ECEEDF88A977`(`llegada_tardia_id`),
    UNIQUE INDEX `UNIQ_97D9ECEEE9FE9372`(`permiso_con_goce_id`),
    UNIQUE INDEX `UNIQ_97D9ECEE4A1627FE`(`permiso_sin_goce_id`),
    UNIQUE INDEX `UNIQ_97D9ECEE89D8089F`(`preaviso_id`),
    UNIQUE INDEX `UNIQ_97D9ECEEDF363018`(`salida_anticipada_id`),
    UNIQUE INDEX `UNIQ_97D9ECEEA0E4F3B3`(`separacion_temp_id`),
    UNIQUE INDEX `UNIQ_97D9ECEE5D5F8F8E`(`suspension_id`),
    UNIQUE INDEX `UNIQ_97D9ECEEA74E1638`(`traslado_id`),
    UNIQUE INDEX `UNIQ_97D9ECEEE78BA714`(`traslado_temp_id`),
    UNIQUE INDEX `UNIQ_97D9ECEEEEC5118E`(`vacacion_disfrute_id`),
    UNIQUE INDEX `UNIQ_97D9ECEEAD90890`(`vacacion_pago_id`),
    INDEX `IDX_97D9ECEE3C5F34F`(`corpo_id`),
    INDEX `IDX_97D9ECEE45BFCF7F`(`tipoAccion_id`),
    INDEX `IDX_97D9ECEE4959F1BA`(`horario_id`),
    INDEX `IDX_97D9ECEE5035E9DA`(`puesto_id`),
    INDEX `IDX_97D9ECEE521E1991`(`empresa_id`),
    INDEX `IDX_97D9ECEE620C225E`(`reemplazo_id`),
    INDEX `IDX_97D9ECEE70AE7BF1`(`contrato_id`),
    INDEX `IDX_97D9ECEE81B56B3`(`coordinadoPor_id`),
    INDEX `IDX_97D9ECEE952BE730`(`empleado_id`),
    INDEX `IDX_97D9ECEEB0B41592`(`tipoContratacion_id`),
    INDEX `IDX_97D9ECEEC4298A13`(`vacacionMes_id`),
    INDEX `IDX_97D9ECEED2624C39`(`periodoPago_id`),
    INDEX `IDX_97D9ECEEDE734E51`(`cliente_id`),
    INDEX `IDX_97D9ECEEE4517BDD`(`coordinador_id`),
    INDEX `IDX_97D9ECEEED33694C`(`categoriaEmpleado_id`),
    INDEX `IDX_97D9ECEEEF34C0BD`(`plaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_marca_dia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` DATE NOT NULL,
    `accionPersonal_id` INTEGER NULL,
    `cliente_id` INTEGER NULL,
    `contrato_id` INTEGER NULL,
    `coordinador_id` INTEGER NULL,
    `corpo_id` INTEGER NULL,
    `empleadoCDG_id` INTEGER NULL,
    `empleadoFijo_id` INTEGER NULL,
    `empleadoReemplaza2_id` INTEGER NULL,
    `empleadoReemplaza_id` INTEGER NULL,
    `empresa_id` INTEGER NULL,
    `hora_entrada` TIME(0) NULL,
    `hora_entrada_digitada` DATETIME(0) NULL,
    `hora_fin` TIME(0) NULL,
    `hora_fin_plan` TIME(0) NULL,
    `hora_inicio` TIME(0) NULL,
    `hora_inicio_plan` TIME(0) NULL,
    `hora_mas_cuatro` TIME(0) NULL,
    `hora_mas_cuatro_digitada` DATETIME(0) NULL,
    `hora_mas_cuatro_entrada` DATETIME(0) NULL,
    `hora_salida` TIME(0) NULL,
    `hora_salida_anticipada` TIME(0) NULL,
    `hora_salida_digitada` DATETIME(0) NULL,
    `horario_id` INTEGER NULL,
    `horas_duracion` DECIMAL(10, 0) NULL,
    `is_dia_excepcion` BOOLEAN NULL,
    `is_puesto_no_cubierto` BOOLEAN NULL,
    `is_reposicion_de_horas` BOOLEAN NULL,
    `marcaCdgHacia_id` INTEGER NULL,
    `marcaComoReemplazo2_id` INTEGER NULL,
    `marcaComoReemplazo_id` INTEGER NULL,
    `marcaEnInduccion_id` INTEGER NULL,
    `motivoErrorAsignacion_id` INTEGER NULL,
    `motivoExtra_id` INTEGER NULL,
    `motivoMarcarHorarioPlaza_id` INTEGER NULL,
    `motivo_ausente` VARCHAR(5) NULL,
    `motivo_cdg` VARCHAR(3) NULL,
    `motivo_induccion` VARCHAR(10) NULL,
    `motivo_separacion_temp` VARCHAR(5) NULL,
    `observaciones` VARCHAR(150) NULL,
    `operacion_accion` BOOLEAN NULL,
    `operacion_extra` BOOLEAN NULL,
    `plaza_id` INTEGER NULL,
    `puesto_id` INTEGER NULL,
    `teorico` BOOLEAN NULL,
    `tipo_comida` VARCHAR(3) NULL,
    `tipo_turno` VARCHAR(1) NULL,
    `tipo_turno_plan` VARCHAR(1) NULL,
    `usuario_marca_entrada` VARCHAR(20) NULL,
    `usuario_marca_salida` VARCHAR(20) NULL,
    `usuarioMarcaEntrada` VARCHAR(191) NULL,
    `salida_anticipada_id` INTEGER NULL,
    `is_cubierto_como_comodin` BOOLEAN NULL,

    UNIQUE INDEX `UNIQ_583C45E5547FB693`(`marcaCdgHacia_id`),
    INDEX `IDX_583C45E52F4E077F`(`motivoMarcarHorarioPlaza_id`),
    INDEX `IDX_583C45E537A7CDB4`(`marcaComoReemplazo_id`),
    INDEX `IDX_583C45E53C5F34F`(`corpo_id`),
    INDEX `IDX_583C45E53CE4E731`(`empleadoFijo_id`),
    INDEX `IDX_583C45E54558C79`(`accionPersonal_id`),
    INDEX `IDX_583C45E54959F1BA`(`horario_id`),
    INDEX `IDX_583C45E55035E9DA`(`puesto_id`),
    INDEX `IDX_583C45E5521E1991`(`empresa_id`),
    INDEX `IDX_583C45E56B95DB`(`empleadoCDG_id`),
    INDEX `IDX_583C45E570AE7BF1`(`contrato_id`),
    INDEX `IDX_583C45E58602BB`(`motivoExtra_id`),
    INDEX `IDX_583C45E58E25225`(`marcaComoReemplazo2_id`),
    INDEX `IDX_583C45E59D7193A2`(`empleadoReemplaza_id`),
    INDEX `IDX_583C45E5BBF7CA96`(`marcaEnInduccion_id`),
    INDEX `IDX_583C45E5DE734E51`(`cliente_id`),
    INDEX `IDX_583C45E5E4517BDD`(`coordinador_id`),
    INDEX `IDX_583C45E5EF34C0BD`(`plaza_id`),
    INDEX `IDX_583C45E5F9838DA4`(`motivoErrorAsignacion_id`),
    INDEX `IDX_583C45E5FC9C312A`(`empleadoReemplaza2_id`),
    INDEX `fecha_idx`(`fecha`),
    INDEX `fecha_tipoTurno_idx`(`fecha`, `tipo_turno`),
    INDEX `isDiaExcepcion_idx`(`is_dia_excepcion`),
    INDEX `isPuestoNoCubierto_idx`(`is_puesto_no_cubierto`),
    INDEX `isReposicionDeHoras_idx`(`is_reposicion_de_horas`),
    INDEX `motivoAusente_idx`(`motivo_ausente`),
    INDEX `motivoCdg_idx`(`motivo_cdg`),
    INDEX `motivoInduccion_idx`(`motivo_induccion`),
    INDEX `motivoSeparacionTemp_idx`(`motivo_separacion_temp`),
    INDEX `operacionAccion_idx`(`operacion_accion`),
    INDEX `operacionExtra_idx`(`operacion_extra`),
    INDEX `tipoTurnoPlan_idx`(`tipo_turno_plan`),
    INDEX `tipoTurno_idx`(`tipo_turno`),
    INDEX `usuarioMarcaEntrada_idx`(`usuario_marca_entrada`),
    INDEX `usuarioMarcaSalida_idx`(`usuario_marca_salida`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `a_recibo_pago` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `fecha_introduccion` DATE NOT NULL,
    `fecha` DATE NOT NULL,
    `numero_factura` VARCHAR(60) NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `descripcion` VARCHAR(254) NULL,

    INDEX `IDX_23679AA8DE734E51`(`cliente_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `b_consecutivo_empresa_banco` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `banco_id` INTEGER NULL,
    `empresa_id` INTEGER NULL,
    `consecutivo` INTEGER NOT NULL,

    INDEX `IDX_E8669A36521E1991`(`empresa_id`),
    INDEX `IDX_E8669A36CC04A73E`(`banco_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `b_pago_excluido` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `tipo_planilla` VARCHAR(20) NULL,
    `id_foraneo` INTEGER NOT NULL,
    `estado` VARCHAR(20) NULL,
    `fecha_creado` DATETIME(0) NOT NULL,
    `fecha_pagado` DATETIME(0) NULL,
    `usuario_inserta` VARCHAR(64) NULL,
    `usuario_paga` VARCHAR(64) NULL,

    INDEX `IDX_E34A23BC952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_adendas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `fecha_fin_contrato` DATE NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `created_by` VARCHAR(255) NOT NULL,
    `fecha_contrato_previo` DATE NULL,
    `observaciones` VARCHAR(255) NULL,
    `apoderado_id` INTEGER NULL,

    INDEX `IDX_C15A2329952BE730`(`empleado_id`),
    INDEX `IDX_C15A2329A1C0A276`(`apoderado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_ajuste_salario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `salario_inicial` DECIMAL(10, 2) NOT NULL,
    `salario_final` DECIMAL(10, 2) NOT NULL,
    `motivo` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_ajuste_salario_masivo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `fecha` DATE NOT NULL,
    `por_ciento` DECIMAL(10, 6) NOT NULL,
    `empleados` LONGTEXT NULL,
    `estado` VARCHAR(20) NULL,
    `created_at` DATE NULL,
    `updated_at` DATE NULL,
    `deleted_at` DATE NULL,
    `confirmed_at` DATE NULL,
    `empleados_tree_show` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_articulo_uniforme_plaza` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `combo_id` INTEGER NULL,
    `cantidad` INTEGER NOT NULL,
    `articuloUniforme_id` INTEGER NOT NULL,

    INDEX `IDX_9F3A46B04591C704`(`articuloUniforme_id`),
    INDEX `IDX_9F3A46B0EB6587E3`(`combo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_ausencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_baja` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `recontratable` BOOLEAN NULL,
    `preaviso_id` INTEGER NULL,

    UNIQUE INDEX `UNIQ_F87CC83189D8089F`(`preaviso_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_baja__n_motivo_no_recontratable` (
    `cbaja_id` INTEGER NOT NULL,
    `nmotivonorecontratable_id` INTEGER NOT NULL,

    INDEX `IDX_4E7270C72DDF1AAA`(`cbaja_id`),
    INDEX `IDX_4E7270C73F43B690`(`nmotivonorecontratable_id`),
    PRIMARY KEY (`cbaja_id`, `nmotivonorecontratable_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_bonificacion_turno` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo_turno` VARCHAR(3) NULL,
    `hora_inicio` TIME(0) NULL,
    `hora_fin` TIME(0) NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `observaciones` VARCHAR(254) NULL,
    `contrato_id` INTEGER NULL,
    `categoriaEmpleado_id` INTEGER NULL,

    INDEX `IDX_1F8A4D4970AE7BF1`(`contrato_id`),
    INDEX `IDX_1F8A4D49ED33694C`(`categoriaEmpleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_bonificaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `fecha_inicio` DATE NOT NULL,
    `fecha_vencimiento` DATE NULL,
    `permanente` BOOLEAN NOT NULL,
    `moneda` INTEGER NOT NULL,
    `monto_mensual` DECIMAL(10, 2) NOT NULL,
    `monto_periodo` DECIMAL(10, 2) NOT NULL,
    `detalles` VARCHAR(254) NULL,
    `deleted_at` DATE NULL,

    INDEX `IDX_3DBD73D9952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_cambio_guardia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `coordinador_id` INTEGER NULL,
    `fecha_reemplaza` DATE NULL,
    `turno_reemplaza` VARCHAR(50) NULL,
    `fecha_ausente` DATE NULL,
    `turno_ausente` VARCHAR(50) NULL,
    `motivo_ausente` VARCHAR(6) NULL,
    `descripcion` VARCHAR(254) NULL,
    `document` VARCHAR(255) NULL,
    `updated_at` DATE NULL,
    `empleadoReemplaza_id` INTEGER NOT NULL,
    `plazaReemplaza_id` INTEGER NULL,
    `marcaDiaReemplaza_id` INTEGER NULL,
    `empleadoAusente_id` INTEGER NULL,
    `plazaAusente_id` INTEGER NULL,
    `marcaDiaAusente_id` INTEGER NULL,
    `accionPersonal_id` INTEGER NULL,
    `tipo` VARCHAR(5) NOT NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_reversion` DATETIME(0) NULL,
    `usuario_reversion` VARCHAR(255) NULL,
    `motivo_reversion` VARCHAR(100) NULL,
    `coordinadoPor_id` INTEGER NULL,
    `consecutivo` VARCHAR(15) NULL,
    `motivo_ausencia_empleado_ausente` VARCHAR(255) NULL,
    `motivo_ausencia_empleado_reemplaza` VARCHAR(255) NULL,

    UNIQUE INDEX `UNIQ_285F043315ABD58`(`marcaDiaReemplaza_id`),
    UNIQUE INDEX `UNIQ_285F04335FB34B5B`(`marcaDiaAusente_id`),
    INDEX `IDX_285F04334558C79`(`accionPersonal_id`),
    INDEX `IDX_285F043360ACC8FA`(`plazaAusente_id`),
    INDEX `IDX_285F043375F636ED`(`empleadoAusente_id`),
    INDEX `IDX_285F043381B56B3`(`coordinadoPor_id`),
    INDEX `IDX_285F04339D7193A2`(`empleadoReemplaza_id`),
    INDEX `IDX_285F0433C2F7DD75`(`plazaReemplaza_id`),
    INDEX `IDX_285F0433E4517BDD`(`coordinador_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_cambio_horario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `horarioInicial_id` INTEGER NULL,
    `horarioFinal_id` INTEGER NULL,
    `categoriaSalarialInicial_id` INTEGER NULL,
    `categoriaSalarialFinal_id` INTEGER NULL,

    INDEX `IDX_E6A5B2C1186B3418`(`horarioInicial_id`),
    INDEX `IDX_E6A5B2C16E94741B`(`horarioFinal_id`),
    INDEX `IDX_E6A5B2C1AF8A0D2D`(`categoriaSalarialInicial_id`),
    INDEX `IDX_E6A5B2C1B8F00EA0`(`categoriaSalarialFinal_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_cambio_periodo_pago` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `periodoPagoInicial_id` INTEGER NULL,
    `periodoPagoFinal_id` INTEGER NULL,

    INDEX `IDX_C869871ABB712BEE`(`periodoPagoInicial_id`),
    INDEX `IDX_C869871ACD4171BE`(`periodoPagoFinal_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_changelog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `version` VARCHAR(30) NULL,
    `fecha_inicio` DATE NULL,
    `fecha_fin` DATE NULL,
    `fecha_liberacion` DATE NULL,
    `descripcion` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_combo_uniforme_plaza` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` VARCHAR(255) NULL,

    UNIQUE INDEX `UNIQ_7E3DD1833A909126`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_configuracion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tiempo_subir_adjunto_acciones` INTEGER NOT NULL,
    `tiempo_justificar_ausencia` INTEGER NOT NULL,
    `max_horas_xsem_semanales` INTEGER NOT NULL,
    `max_horas_xmes_semanales` INTEGER NOT NULL,
    `max_horas_xsem_quincenales` INTEGER NOT NULL,
    `max_horas_xmes_quincenales` INTEGER NOT NULL,
    `llegada_tardia_minimo` INTEGER NOT NULL,
    `llegada_tardia_maximo` INTEGER NOT NULL,
    `dias_gracia_fin_contrato` INTEGER NOT NULL DEFAULT 60,
    `dias_gracia_portacion` INTEGER NOT NULL DEFAULT 15,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_contratacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_curso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `fecha_inicio` DATE NULL,
    `fecha_fin` DATE NULL,
    `fecha_vence` DATE NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_curso_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `curso_id` INTEGER NULL,
    `empleado_id` INTEGER NULL,
    `descripcion` VARCHAR(255) NULL,

    INDEX `IDX_EF09AA1287CB4A1F`(`curso_id`),
    INDEX `IDX_EF09AA12952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_deudas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `monto_total` DECIMAL(10, 2) NOT NULL,
    `monto_restante` DECIMAL(10, 2) NULL,
    `fecha_inicio` DATE NOT NULL,
    `pagado` BOOLEAN NOT NULL,
    `monto_cuota` DECIMAL(10, 2) NOT NULL,
    `numero_cuotas_plan` INTEGER NOT NULL,
    `detalles` VARCHAR(254) NULL,
    `deleted_at` DATE NULL,
    `monto_pagado` DECIMAL(10, 2) NULL,
    `tipoDeudas_id` INTEGER NULL,
    `permanente` BOOLEAN NULL,
    `monto_pagado_inicial` DECIMAL(10, 2) NOT NULL,
    `document` VARCHAR(255) NULL,
    `updated_at` DATE NULL,
    `created_at` DATE NULL,
    `monto_mensual` DECIMAL(10, 2) NOT NULL,

    INDEX `IDX_8AB91D2C6C9408BE`(`tipoDeudas_id`),
    INDEX `IDX_8AB91D2C952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_email_regla_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(255) NOT NULL,
    `asunto` VARCHAR(255) NOT NULL,
    `listaDestinatario` LONGTEXT NOT NULL,
    `activo` BOOLEAN NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_embargos_judiciales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deuda_id` INTEGER NULL,
    `actor` VARCHAR(100) NOT NULL,
    `caso` VARCHAR(50) NOT NULL,
    `competencia` VARCHAR(50) NOT NULL,
    `fecha_recibido` DATE NOT NULL,
    `salario_declarar` DECIMAL(10, 2) NOT NULL,

    UNIQUE INDEX `UNIQ_68326432C5CAD3D1`(`deuda_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_embargos_pension_alimentaria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deuda_id` INTEGER NULL,
    `actor` VARCHAR(100) NOT NULL,
    `caso` VARCHAR(50) NOT NULL,
    `competencia` VARCHAR(50) NOT NULL,
    `fecha_recibido` DATE NOT NULL,
    `mensualidad` DECIMAL(10, 2) NOT NULL,
    `aguinaldo` DECIMAL(10, 2) NULL,
    `salario_escolar` DECIMAL(10, 2) NULL,

    UNIQUE INDEX `UNIQ_B2678676C5CAD3D1`(`deuda_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `banco_id` INTEGER NULL,
    `supervisor_id` INTEGER NULL,
    `nacionalidad_id` INTEGER NULL,
    `nombre` VARCHAR(32) NULL,
    `segundo_apellido` VARCHAR(32) NULL,
    `primer_apellido` VARCHAR(32) NULL,
    `cedula` VARCHAR(64) NOT NULL,
    `foto` VARCHAR(255) NULL,
    `salario` DECIMAL(10, 0) NULL,
    `talla_calzado` VARCHAR(10) NULL,
    `talla_pantalon` VARCHAR(10) NULL,
    `talla_camisa` VARCHAR(10) NULL,
    `peso` INTEGER NULL,
    `estatura` INTEGER NULL,
    `Email` VARCHAR(52) NULL,
    `telefono` VARCHAR(255) NULL,
    `tipoCedula` VARCHAR(255) NULL,
    `fechaVencimientoCedula` DATE NULL,
    `fechaNacimiento` DATE NULL,
    `cantidad_deuda` DECIMAL(10, 0) NULL,
    `otro_ingreso` VARCHAR(52) NULL,
    `tipoPagoCasa_id` INTEGER NULL,
    `estadoCivil_id` INTEGER NULL,
    `domicilio` VARCHAR(255) NULL,
    `sindicato_id` INTEGER NULL,
    `codigo` VARCHAR(20) NOT NULL,
    `disponible_monitoreo` BOOLEAN NULL,
    `fecha_contratacion` DATE NULL,
    `numero_seguro_social` VARCHAR(32) NULL,
    `sexo` VARCHAR(1) NULL,
    `talla_camiseta` VARCHAR(10) NULL,
    `talla_jacket` VARCHAR(10) NULL,
    `telefono_otro` VARCHAR(255) NULL,
    `celular` VARCHAR(255) NULL,
    `pensionado` BOOLEAN NULL,
    `numero_hijos` INTEGER NULL,
    `banco_nro_cuenta` VARCHAR(255) NULL,
    `fecha_psicologico_vence` DATE NULL,
    `fecha_portacion_vence` DATE NULL,
    `periodoPago_id` INTEGER NULL,
    `seguroCaja_id` INTEGER NULL,
    `educacionPrimaria_id` INTEGER NULL,
    `educacionSecundaria_id` INTEGER NULL,
    `educacionUniversidad_id` INTEGER NULL,
    `educacionTecnico_id` INTEGER NULL,
    `tipoContratacion_id` INTEGER NULL,
    `escolaridad_id` INTEGER NULL,
    `estado` VARCHAR(2) NULL,
    `solicitud_id` INTEGER NULL,
    `es_comodin` BOOLEAN NULL,
    `comboUniforme_id` INTEGER NULL,
    `categoriaEmpleado_id` INTEGER NULL,
    `plazaEmpleado_id` INTEGER NULL,
    `duracion_del_contrato` VARCHAR(2) NULL,
    `fecha_fin_contrato` DATE NULL,
    `carrera_estudiada` VARCHAR(50) NULL,
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `password_expires_at` DATETIME(0) NULL,
    `password` VARCHAR(255) NULL,
    `locked` BOOLEAN NULL,
    `codigo_verificacion` VARCHAR(350) NULL,
    `last_checked_update` DATETIME(0) NULL,
    `firma_manual` LONGTEXT NULL,
    `ingresado` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `UNIQ_C84A39991CB9D6E4`(`solicitud_id`),
    INDEX `IDX_C84A3999114FAA7C`(`educacionTecnico_id`),
    INDEX `IDX_C84A399919E9AC5F`(`supervisor_id`),
    INDEX `IDX_C84A399928F0D5CA`(`escolaridad_id`),
    INDEX `IDX_C84A39992BAEF284`(`estadoCivil_id`),
    INDEX `IDX_C84A399955CD1AE4`(`educacionUniversidad_id`),
    INDEX `IDX_C84A39995EEC5E1B`(`educacionPrimaria_id`),
    INDEX `IDX_C84A39996EA899DA`(`plazaEmpleado_id`),
    INDEX `IDX_C84A399979F98940`(`seguroCaja_id`),
    INDEX `IDX_C84A39998D7C55D2`(`sindicato_id`),
    INDEX `IDX_C84A3999996BD967`(`educacionSecundaria_id`),
    INDEX `IDX_C84A3999A07740F`(`comboUniforme_id`),
    INDEX `IDX_C84A3999AB8DC0F8`(`nacionalidad_id`),
    INDEX `IDX_C84A3999B0B41592`(`tipoContratacion_id`),
    INDEX `IDX_C84A3999CC04A73E`(`banco_id`),
    INDEX `IDX_C84A3999D2624C39`(`periodoPago_id`),
    INDEX `IDX_C84A3999ED33694C`(`categoriaEmpleado_id`),
    INDEX `IDX_C84A3999FCBB0AEC`(`tipoPagoCasa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_empleado_basedatos_digital` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `path` VARCHAR(255) NULL,
    `solicitud_id` INTEGER NULL,

    INDEX `IDX_9BF4295A1CB9D6E4`(`solicitud_id`),
    INDEX `IDX_9BF4295A952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_empleado_datos_adjuntos_rrhh` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `fecha` DATE NOT NULL,
    `observaciones` VARCHAR(255) NULL,
    `path` VARCHAR(255) NULL,
    `tipoDatoAdjunto_id` INTEGER NULL,

    INDEX `IDX_FE891195A2DE568`(`tipoDatoAdjunto_id`),
    INDEX `IDX_FE89119952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_empleado_gasto_principal` (
    `cempleado_id` INTEGER NOT NULL,
    `egastoprincipal_id` INTEGER NOT NULL,

    INDEX `IDX_6136C13518864C8`(`egastoprincipal_id`),
    INDEX `IDX_6136C13DAB52E4B`(`cempleado_id`),
    PRIMARY KEY (`cempleado_id`, `egastoprincipal_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_empleado_plaza` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `plaza_id` INTEGER NULL,
    `puesto_id` INTEGER NULL,
    `corpo_id` INTEGER NULL,
    `contrato_id` INTEGER NULL,
    `cliente_id` INTEGER NULL,
    `empresa_id` INTEGER NULL,
    `horario_id` INTEGER NULL,
    `salario` DECIMAL(10, 2) NULL,
    `division_id` INTEGER NULL,
    `ejecutivoCuenta_id` INTEGER NULL,

    INDEX `IDX_9F05308D3C5F34F`(`corpo_id`),
    INDEX `IDX_9F05308D41859289`(`division_id`),
    INDEX `IDX_9F05308D4959F1BA`(`horario_id`),
    INDEX `IDX_9F05308D5035E9DA`(`puesto_id`),
    INDEX `IDX_9F05308D521E1991`(`empresa_id`),
    INDEX `IDX_9F05308D5CAEAC5D`(`ejecutivoCuenta_id`),
    INDEX `IDX_9F05308D70AE7BF1`(`contrato_id`),
    INDEX `IDX_9F05308D952BE730`(`empleado_id`),
    INDEX `IDX_9F05308DDE734E51`(`cliente_id`),
    INDEX `IDX_9F05308DEF34C0BD`(`plaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_empleado_referencias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `fechaCompletado` DATE NOT NULL,
    `createdAt` DATETIME(0) NOT NULL,
    `updatedAt` DATETIME(0) NOT NULL,
    `comentarios` VARCHAR(1000) NULL,
    `clasificacionReferencia_id` INTEGER NULL,
    `discr` VARCHAR(255) NOT NULL,
    `empresa` VARCHAR(255) NULL,
    `jefeInmediato` VARCHAR(255) NULL,
    `puestoDesempennado` VARCHAR(255) NULL,
    `personaReferencia` VARCHAR(255) NULL,
    `telefono` VARCHAR(255) NULL,
    `fechaInicio` DATE NULL,
    `fechaFinal` DATE NULL,
    `motivoSalida` VARCHAR(255) NULL,
    `recontratable` BOOLEAN NULL,
    `nombrePersona` VARCHAR(255) NULL,
    `tiempoConocerlo` VARCHAR(255) NULL,
    `poseeHijos` BOOLEAN NULL,
    `lugarResidencia` VARCHAR(255) NULL,
    `conocePQDejoLaborar` VARCHAR(255) NULL,
    `estadoCivil_id` INTEGER NULL,
    `solicitud_id` INTEGER NULL,

    INDEX `IDX_E5ADCE2D1CB9D6E4`(`solicitud_id`),
    INDEX `IDX_E5ADCE2D2BAEF284`(`estadoCivil_id`),
    INDEX `IDX_E5ADCE2D952BE730`(`empleado_id`),
    INDEX `IDX_E5ADCE2DD3F1ED37`(`clasificacionReferencia_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_empleado_registro_laboral` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `descripcion` VARCHAR(255) NULL,
    `path` VARCHAR(255) NULL,
    `tipoRegistroLaboral_id` INTEGER NULL,

    INDEX `IDX_30CD41E5952BE730`(`empleado_id`),
    INDEX `IDX_30CD41E5AC3051D`(`tipoRegistroLaboral_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_empleado_sindicato` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sindicato_id` INTEGER NOT NULL,
    `empleado_id` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `porcentaje` DECIMAL(3, 2) NULL,
    `fecha_alta` DATE NULL,
    `fecha_baja` DATE NULL,

    INDEX `IDX_7F8A7D598D7C55D2`(`sindicato_id`),
    INDEX `IDX_7F8A7D59952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_empleado_sindicato_adjuntos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_sindicato_id` INTEGER NOT NULL,
    `document` VARCHAR(255) NULL,
    `fecha_creado` DATE NULL,
    `fecha_eliminado` DATE NULL,

    INDEX `IDX_2CD97FCF6F9D0169`(`empleado_sindicato_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_empleado_tramite_portacion_arma` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `fecha_creacion` DATE NULL,
    `fecha_vencimiento` DATE NULL,

    INDEX `IDX_E46810F952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_extra_limite_semanal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `limite_semanal` INTEGER NOT NULL,
    `comentarios` VARCHAR(254) NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_reversion` DATETIME(0) NULL,
    `usuario_reversion` VARCHAR(255) NULL,
    `fecha` DATE NOT NULL,
    `tipo_limite` VARCHAR(3) NULL,

    INDEX `IDX_A0512A95952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_extra_tarifa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `fecha_inicio` DATE NOT NULL,
    `fecha_fin` DATE NULL,
    `tipo` VARCHAR(30) NOT NULL,
    `observaciones` VARCHAR(254) NULL,
    `abarca_todos_los_corpos` BOOLEAN NULL,
    `activo` BOOLEAN NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_extra_tarifa_corpo` (
    `cextratarifa_id` INTEGER NOT NULL,
    `sucursal_id` INTEGER NOT NULL,

    INDEX `IDX_E3FAC1FB279A5D5E`(`sucursal_id`),
    INDEX `IDX_E3FAC1FB3AD4FFE2`(`cextratarifa_id`),
    PRIMARY KEY (`cextratarifa_id`, `sucursal_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_extra_tarifa_rango` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `horas_inicio` DECIMAL(10, 2) NOT NULL,
    `horas_fin` DECIMAL(10, 2) NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `extraTarifa_id` INTEGER NULL,

    INDEX `IDX_4E1AD678ED0E28FB`(`extraTarifa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_fecha_excepcional` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `horario_id` INTEGER NULL,
    `empleado_id` INTEGER NULL,
    `fecha` DATE NULL,
    `observacion` VARCHAR(254) NULL,

    INDEX `IDX_403BB7FF4959F1BA`(`horario_id`),
    INDEX `IDX_403BB7FF952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_feriado_calendario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(254) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_feriado_dia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(254) NULL,
    `fecha` DATE NULL,
    `pago_obligatorio` BOOLEAN NULL,
    `feriadoCalendario_id` INTEGER NULL,

    INDEX `IDX_9B00E14AB1C52DFC`(`feriadoCalendario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_horario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(250) NOT NULL,
    `fecha_activacion` DATE NOT NULL,
    `deleted_at` DATE NULL,
    `activo` BOOLEAN NULL,
    `tiene_almuerzo` BOOLEAN NULL,
    `minutos_almuerzo` INTEGER NULL,
    `tipo_contrato` VARCHAR(3) NULL,
    `tipo_rotacion` VARCHAR(3) NULL,
    `inactivated_at` DATE NULL,
    `jornada_acumulativa` BOOLEAN NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_reversion` DATETIME(0) NULL,
    `usuario_reversion` VARCHAR(255) NULL,
    `inactivated_by` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_horario_dia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `horario_id` INTEGER NULL,
    `dia` INTEGER NOT NULL,
    `hora_inicio` TIME(0) NULL,
    `hora_fin` TIME(0) NULL,
    `hora_almuerzo` TIME(0) NULL,
    `semana` INTEGER NOT NULL,
    `activo` BOOLEAN NULL,
    `tipo` VARCHAR(1) NULL,
    `plaza_id` INTEGER NULL,
    `teorico` BOOLEAN NULL,

    INDEX `IDX_E719D4BD4959F1BA`(`horario_id`),
    INDEX `IDX_E719D4BDEF34C0BD`(`plaza_id`),
    INDEX `dia_idx`(`dia`),
    INDEX `semana_idx`(`semana`),
    INDEX `tipo_idx`(`tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_incapacidad_ccss` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(3) NOT NULL,
    `salario_base_diario` DECIMAL(10, 2) NOT NULL,
    `dias_subsidio` INTEGER NOT NULL,
    `monto_subsidio_pagar` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_incapacidad_ins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(10) NOT NULL,
    `numero_poliza` VARCHAR(50) NULL,
    `empresa_id` INTEGER NULL,
    `empresaPoliza_id` INTEGER NULL,

    INDEX `IDX_80539B87521E1991`(`empresa_id`),
    INDEX `IDX_80539B8779CCE94D`(`empresaPoliza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_induccion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NULL,
    `numero_dias` INTEGER NULL,
    `fecha1` DATE NULL,
    `fecha2` DATE NULL,
    `fecha3` DATE NULL,
    `observaciones` VARCHAR(254) NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,

    INDEX `IDX_371730A5035E9DA`(`puesto_id`),
    INDEX `IDX_371730A952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_induccion_dia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `induccion_id` INTEGER NOT NULL,
    `plaza_id` INTEGER NULL,
    `fecha` DATE NOT NULL,
    `tipo_turno` VARCHAR(1) NULL,
    `horario_str` VARCHAR(20) NULL,
    `cantidad_horas` DECIMAL(5, 2) NOT NULL,
    `presente` BOOLEAN NULL,
    `marcaDia_id` INTEGER NULL,
    `coincide_horario` BOOLEAN NULL,

    INDEX `IDX_E5590D543CEEDC64`(`induccion_id`),
    INDEX `IDX_E5590D547963DFC5`(`marcaDia_id`),
    INDEX `IDX_E5590D54EF34C0BD`(`plaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_inducciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `coordinador_id` INTEGER NULL,
    `fecha_reemplaza` DATE NULL,
    `turno_reemplaza` VARCHAR(50) NULL,
    `fecha_ausente` DATE NULL,
    `turno_ausente` VARCHAR(50) NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `descripcion` VARCHAR(254) NULL,
    `motivo_reversion` VARCHAR(100) NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_reversion` DATETIME(0) NULL,
    `usuario_reversion` VARCHAR(255) NULL,
    `plazaOrigen_id` INTEGER NULL,
    `marcaDiaOrigen_id` INTEGER NULL,
    `empleadoDestino_id` INTEGER NULL,
    `plazaDestino_id` INTEGER NULL,
    `marcaDiaDestino_id` INTEGER NULL,
    `coordinadoPor_id` INTEGER NULL,
    `extra_id` INTEGER NULL,

    UNIQUE INDEX `UNIQ_A3BC66E663ED981F`(`marcaDiaOrigen_id`),
    UNIQUE INDEX `UNIQ_A3BC66E68C1B0AEB`(`marcaDiaDestino_id`),
    UNIQUE INDEX `UNIQ_A3BC66E62B959FC6`(`extra_id`),
    INDEX `IDX_A3BC66E681B56B3`(`coordinadoPor_id`),
    INDEX `IDX_A3BC66E6952BE730`(`empleado_id`),
    INDEX `IDX_A3BC66E6A65E775D`(`empleadoDestino_id`),
    INDEX `IDX_A3BC66E6B304894A`(`plazaDestino_id`),
    INDEX `IDX_A3BC66E6C968E4B9`(`plazaOrigen_id`),
    INDEX `IDX_A3BC66E6E4517BDD`(`coordinador_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_intercambio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(254) NULL,
    `fecha` DATE NOT NULL,
    `descripcion` VARCHAR(254) NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_reversion` DATETIME(0) NULL,
    `usuario_reversion` VARCHAR(255) NULL,
    `observaciones_motivo_traslado` VARCHAR(255) NULL,
    `observaciones_cambio_salario` VARCHAR(255) NULL,
    `consecutivo` VARCHAR(15) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_intercambio_linea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `intercambio_id` INTEGER NULL,
    `empleado_id` INTEGER NULL,
    `plazaInicio_id` INTEGER NULL,
    `plazaFin_id` INTEGER NULL,
    `empleadoSustituido_id` INTEGER NULL,
    `archivo_adjunto_id` LONGTEXT NULL,
    `archivo_adjunto_nombre` LONGTEXT NULL,

    INDEX `IDX_88E784CE4BC37A6F`(`intercambio_id`),
    INDEX `IDX_88E784CE77BB7125`(`plazaInicio_id`),
    INDEX `IDX_88E784CE952BE730`(`empleado_id`),
    INDEX `IDX_88E784CEAED3850`(`plazaFin_id`),
    INDEX `IDX_88E784CEF883EFAA`(`empleadoSustituido_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_libre_cubre_vacasiones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_licencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `promedio_salario` DECIMAL(10, 2) NOT NULL,
    `monto_subsidio_pagar` DECIMAL(10, 2) NOT NULL,
    `monto_subsidio_reportar` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_llegada_tardia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo_turno` VARCHAR(20) NULL,
    `horario_str` VARCHAR(20) NOT NULL,
    `cantidad_horas` DECIMAL(5, 2) NOT NULL,
    `hora_llegada_tardia` DATETIME(0) NOT NULL,
    `minutos_descuento` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_permiso_con_goce` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_permiso_sin_goce` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_preaviso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo_preaviso` VARCHAR(254) NULL,
    `numero_dias` INTEGER NULL,
    `fecha_inicio` DATE NULL,
    `fecha_fin_labores` DATE NULL,
    `fecha_semana_1` DATE NULL,
    `fecha_semana_2` DATE NULL,
    `fecha_semana_3` DATE NULL,
    `fecha_semana_4` DATE NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_rol_tipoaccion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `observaciones` VARCHAR(254) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_roltipoaccion_tipoaccion` (
    `croltipoaccion_id` INTEGER NOT NULL,
    `ctipoaccion_id` INTEGER NOT NULL,

    INDEX `IDX_48CD1A52C9F2F869`(`croltipoaccion_id`),
    INDEX `IDX_48CD1A52E93DD86B`(`ctipoaccion_id`),
    PRIMARY KEY (`croltipoaccion_id`, `ctipoaccion_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_salida_anticipada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo_turno` VARCHAR(20) NULL,
    `horario_str` VARCHAR(20) NOT NULL,
    `cantidad_horas` DECIMAL(5, 2) NOT NULL,
    `hora_salida_anticipada` DATETIME(0) NOT NULL,
    `minutos_descuento` INTEGER NOT NULL,
    `empleado_id` INTEGER NULL,
    `motivo` LONGTEXT NULL,

    INDEX `c_salida_anticipada_empleado_id_fkey`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_separacion_temp` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(10) NOT NULL,
    `motivoAccion` VARCHAR(7) NOT NULL,
    `empleadoTrasladoTemp_id` INTEGER NULL,

    INDEX `IDX_540A8D7C9F59AD70`(`empleadoTrasladoTemp_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_solicitud_empleo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vacante_id` INTEGER NULL,
    `salario_mes_aspira` DECIMAL(10, 0) NULL,
    `nombre` VARCHAR(32) NOT NULL,
    `cedula` VARCHAR(64) NULL,
    `telefono` VARCHAR(15) NULL,
    `correo` VARCHAR(64) NULL,
    `activo` BOOLEAN NULL,
    `descripcion` VARCHAR(255) NULL,
    `division_id` INTEGER NULL,
    `primer_apellido` VARCHAR(32) NULL,
    `segundo_apellido` VARCHAR(32) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `anhos_experiencia` INTEGER NULL,
    `fecha_nacimiento` DATE NULL,
    `manejo_cepillo` BOOLEAN NULL,
    `nacionalidad_id` INTEGER NULL,
    `provincia_id` INTEGER NULL,
    `canton_id` INTEGER NULL,
    `distrito_id` INTEGER NULL,
    `region_id` INTEGER NULL,
    `direccion` VARCHAR(255) NULL,
    `etapa_bd` INTEGER NULL,
    `etapa_bdcom` VARCHAR(255) NULL,
    `etapa_referencias` INTEGER NULL,
    `etapa_referencias_com` VARCHAR(255) NULL,
    `etapa_hoja_delinq` INTEGER NULL,
    `etapa_hoja_delinq_com` VARCHAR(255) NULL,
    `etapa_entrev_comp` INTEGER NULL,
    `etapa_entrev_comp_com` VARCHAR(255) NULL,
    `etapa_entrev_oper` INTEGER NULL,
    `etapa_entrev_oper_com` VARCHAR(255) NULL,
    `etapa_exam_psico` INTEGER NULL,
    `etapa_exam_psico_com` VARCHAR(255) NULL,
    `etapa_tramite` INTEGER NULL,
    `etapa_tramite_com` VARCHAR(255) NULL,
    `etapa_induccion` INTEGER NULL,
    `etapa_induccion_fecha` DATE NULL,
    `etapa_resultado` VARCHAR(50) NULL,
    `etapa_resultado_com` VARCHAR(255) NULL,
    `estado_si_aprobado` VARCHAR(50) NULL,
    `motivo_lista_espera` VARCHAR(50) NULL,
    `estado` VARCHAR(3) NULL,
    `foto_pasaporte` BOOLEAN NULL,
    `fotocopia_cedula` BOOLEAN NULL,
    `hoja_antecedentes` BOOLEAN NULL,
    `titulo_estudios` BOOLEAN NULL,
    `carta_servicio` BOOLEAN NULL,
    `carta_recomendacion` BOOLEAN NULL,
    `carta_carnet_seguro` BOOLEAN NULL,
    `cuenta_ahorro_banco` BOOLEAN NULL,
    `curso_portacion_armas` BOOLEAN NULL,
    `examen_psicologico` BOOLEAN NULL,
    `curso_seguridad_privada` BOOLEAN NULL,
    `huellas_dactilares` BOOLEAN NULL,
    `licencia_vehiculo_moto` BOOLEAN NULL,
    `carnet_vacunas` BOOLEAN NULL,
    `dictamen_medico` BOOLEAN NULL,
    `titulo_estudios_perfil` BOOLEAN NULL,
    `formacion_perfil` BOOLEAN NULL,
    `dictamen_medico_fecha` DATE NULL,
    `etapa_bdusuario` VARCHAR(255) NULL,
    `etapa_referencias_usuario` VARCHAR(255) NULL,
    `etapa_hoja_delinq_usuario` VARCHAR(255) NULL,
    `etapa_entrev_comp_usuario` VARCHAR(255) NULL,
    `etapa_entrev_oper_usuario` VARCHAR(255) NULL,
    `etapa_exam_psico_usuario` VARCHAR(255) NULL,
    `etapa_tramite_usuario` VARCHAR(255) NULL,
    `etapa_induccion_usuario` VARCHAR(255) NULL,
    `etapa_resultado_usuario` VARCHAR(255) NULL,
    `telefono_otro` VARCHAR(15) NULL,
    `escolaridad` VARCHAR(10) NULL,
    `especialidad` VARCHAR(64) NULL,
    `tipo_licencia_moto` VARCHAR(10) NULL,
    `fecha_vence_licencia_moto` DATE NULL,
    `tipo_licencia_auto` VARCHAR(10) NULL,
    `fecha_vence_licencia_auto` DATE NULL,
    `posee_vehiculo_propio` VARCHAR(5) NULL,
    `tipo_vehiculo_propio` VARCHAR(5) NULL,
    `puesto_solicitado` VARCHAR(20) NULL,
    `posee_experiencia` VARCHAR(2) NULL,
    `nivel_idioma` VARCHAR(20) NULL,
    `huellas_actualizado` VARCHAR(2) NULL,
    `examen_psicologico_actualizado` VARCHAR(2) NULL,
    `fecha_vence_psicologico` DATE NULL,
    `portacion_armas` VARCHAR(15) NULL,
    `fecha_vence_portacion_armas` DATE NULL,
    `carnet_seguridad_privada` VARCHAR(15) NULL,
    `fecha_vence_carnet_seguridad_privada` DATE NULL,
    `dispuesto_jornadas_parciales` VARCHAR(2) NULL,
    `posee_carnet_vacunas_actualizado` VARCHAR(2) NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_reversion` DATETIME(0) NULL,
    `usuario_reversion` VARCHAR(255) NULL,
    `estadoCivil_id` INTEGER NULL,
    `tipoPortacionArmas_id` INTEGER NULL,
    `primeraOpcionTrabajar_id` INTEGER NULL,
    `segundaOpcionTrabajar_id` INTEGER NULL,
    `terceraOpcionTrabajar_id` INTEGER NULL,

    INDEX `IDX_4F8484C018586848`(`tipoPortacionArmas_id`),
    INDEX `IDX_4F8484C02BAEF284`(`estadoCivil_id`),
    INDEX `IDX_4F8484C041859289`(`division_id`),
    INDEX `IDX_4F8484C04E7121AF`(`provincia_id`),
    INDEX `IDX_4F8484C06AC7D228`(`terceraOpcionTrabajar_id`),
    INDEX `IDX_4F8484C08B34DB71`(`vacante_id`),
    INDEX `IDX_4F8484C08D070D0B`(`canton_id`),
    INDEX `IDX_4F8484C08E099F24`(`primeraOpcionTrabajar_id`),
    INDEX `IDX_4F8484C098260155`(`region_id`),
    INDEX `IDX_4F8484C0AB8DC0F8`(`nacionalidad_id`),
    INDEX `IDX_4F8484C0B894E495`(`segundaOpcionTrabajar_id`),
    INDEX `IDX_4F8484C0E557397E`(`distrito_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_solicitud_empleo_adjunto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `solicitud_id` INTEGER NOT NULL,
    `tipo_adjunto` VARCHAR(20) NULL,
    `document` VARCHAR(255) NULL,
    `updated_at` DATE NULL,

    INDEX `IDX_55893DCD1CB9D6E4`(`solicitud_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_solicitudempleo__n_idioma` (
    `csolicitudempleo_id` INTEGER NOT NULL,
    `nidioma_id` INTEGER NOT NULL,

    INDEX `IDX_38D7303214714E0A`(`nidioma_id`),
    INDEX `IDX_38D730324248037D`(`csolicitudempleo_id`),
    PRIMARY KEY (`csolicitudempleo_id`, `nidioma_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_suspension` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_tipo_accion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    `codigo` VARCHAR(10) NOT NULL,
    `clase` VARCHAR(10) NULL,
    `afecta_salario` BOOLEAN NULL,
    `afecta_vacaciones` BOOLEAN NULL,
    `afecta_horario` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_tramite_portacion_arma` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipoTramite` VARCHAR(255) NOT NULL,
    `fecha` DATE NOT NULL,
    `path` VARCHAR(255) NULL,
    `empleadoTramitePortacionArma_id` INTEGER NOT NULL,
    `descripcion` VARCHAR(255) NOT NULL,
    `resultado` VARCHAR(255) NOT NULL,

    INDEX `IDX_B71936626D892826`(`empleadoTramitePortacionArma_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_traslado_temp` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha_fin` DATE NULL,
    `datos_horario_plaza_inicial` LONGTEXT NULL,
    `datos_horario_plaza_final` LONGTEXT NULL,
    `plazaInicial_id` INTEGER NULL,

    INDEX `IDX_7B0E282C1B482BBB`(`plazaInicial_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_vacacion_disfrute` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cantidad_dias_disfrutados` DECIMAL(5, 2) NOT NULL,
    `periodo` VARCHAR(255) NULL,
    `monto_pagar` DECIMAL(10, 2) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_vacacion_pago` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cantidad_dias_pagados` DECIMAL(5, 2) NOT NULL,
    `periodo` VARCHAR(255) NULL,
    `fecha_pago` DATE NULL,
    `monto_pagar` DECIMAL(10, 2) NULL,
    `motivo` VARCHAR(254) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consultor_actualizacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `provincia_id` INTEGER NULL,
    `canton_id` INTEGER NULL,
    `distrito_id` INTEGER NULL,
    `fecha` DATETIME(0) NOT NULL,
    `Email` VARCHAR(52) NULL,
    `direccion_exacta` VARCHAR(150) NULL,
    `celular` VARCHAR(20) NULL,
    `telefono_fijo` VARCHAR(20) NULL,
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,

    UNIQUE INDEX `UNIQ_A7D941FB952BE730`(`empleado_id`),
    INDEX `IDX_A7D941FB4E7121AF`(`provincia_id`),
    INDEX `IDX_A7D941FB8D070D0B`(`canton_id`),
    INDEX `IDX_A7D941FBE557397E`(`distrito_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consultor_actualizacion_telefonos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actualizacion_id` INTEGER NOT NULL,
    `tipo` VARCHAR(20) NULL,
    `numero` VARCHAR(20) NULL,

    INDEX `IDX_2CF2054CDF01D38`(`actualizacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consultor_history_checked_update` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `fecha` DATETIME(0) NOT NULL,

    INDEX `IDX_37A84590952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `d_empleado_cartas_recomendacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `path` VARCHAR(255) NULL,
    `solicitud_id` INTEGER NULL,

    INDEX `IDX_244336C1CB9D6E4`(`solicitud_id`),
    INDEX `IDX_244336C952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `d_empleado_hoja_delincuencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `descripcion` VARCHAR(255) NULL,
    `document` VARCHAR(255) NULL,
    `fecha_emision` DATETIME(0) NOT NULL,
    `antecedentes` BOOLEAN NULL,
    `updated_at` DATE NULL,
    `solicitud_id` INTEGER NULL,

    INDEX `IDX_D39F3EAF1CB9D6E4`(`solicitud_id`),
    INDEX `IDX_D39F3EAF952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `d_empleado_otras_anotaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `path` VARCHAR(255) NULL,
    `solicitud_id` INTEGER NULL,

    INDEX `IDX_CAA044011CB9D6E4`(`solicitud_id`),
    INDEX `IDX_CAA04401952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_antecedente_penal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `motivo` VARCHAR(64) NOT NULL,
    `descripcion` VARCHAR(255) NOT NULL,

    INDEX `IDX_47E60268952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_cuenta_banco_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `banco_id` INTEGER NULL,
    `tipo` VARCHAR(32) NOT NULL,
    `nrocuenta` VARCHAR(255) NULL,
    `pagar_planillas` BOOLEAN NULL,
    `pagar_extras` BOOLEAN NULL,
    `pagar_honorarios` BOOLEAN NULL,

    INDEX `IDX_DBE7C3CB952BE730`(`empleado_id`),
    INDEX `IDX_DBE7C3CBCC04A73E`(`banco_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_cursos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `nombre` VARCHAR(64) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `vence` DATE NULL,

    INDEX `IDX_2B0E1353952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_dato_legal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `fecha_visita_domiciliaria` DATE NULL,

    UNIQUE INDEX `UNIQ_3E0AEB71952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_domicilio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `distrito_id` INTEGER NULL,
    `empleado_id` INTEGER NULL,
    `direccion_exacta` VARCHAR(255) NULL,
    `tiempo_residencia` INTEGER NULL,
    `region_id` INTEGER NULL,
    `activo` BOOLEAN NULL,
    `coordenadas_gpslat` VARCHAR(255) NULL,
    `coordenadas_gpslng` VARCHAR(255) NULL,

    INDEX `IDX_7F866C2C952BE730`(`empleado_id`),
    INDEX `IDX_7F866C2C98260155`(`region_id`),
    INDEX `IDX_7F866C2CE557397E`(`distrito_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_educacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,

    UNIQUE INDEX `UNIQ_F2D67309952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_educacion_idiomas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `idioma_id` INTEGER NOT NULL,
    `porciento_idioma` DECIMAL(10, 0) NOT NULL,

    INDEX `IDX_52B18791952BE730`(`empleado_id`),
    INDEX `IDX_52B18791DEDC0611`(`idioma_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_empleado_incumplimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `fecha` DATE NULL,
    `motivo_incumplimiento` LONGTEXT NOT NULL,
    `observaciones` LONGTEXT NULL,
    `amonestacion` VARCHAR(254) NULL,
    `sancion` VARCHAR(254) NULL,
    `tipoSancionAplicada_id` INTEGER NULL,
    `document` VARCHAR(254) NULL,
    `updated_at` DATE NULL,
    `cedula` VARCHAR(64) NULL,
    `accionBaja_id` INTEGER NULL,

    INDEX `IDX_7D24EC63952BE730`(`empleado_id`),
    INDEX `IDX_7D24EC63B0DCC882`(`tipoSancionAplicada_id`),
    INDEX `IDX_7D24EC63F88683D9`(`accionBaja_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_empleado_incumplimiento__n_motivo` (
    `eincumplimiento_id` INTEGER NOT NULL,
    `nmotivoincumplimiento_id` INTEGER NOT NULL,

    INDEX `IDX_A8E899CD37734155`(`eincumplimiento_id`),
    INDEX `IDX_A8E899CD517A96A9`(`nmotivoincumplimiento_id`),
    PRIMARY KEY (`eincumplimiento_id`, `nmotivoincumplimiento_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_empleado_incumplimiento_accion` (
    `eincumplimiento_id` INTEGER NOT NULL,
    `caccionpersonal_id` INTEGER NOT NULL,

    INDEX `IDX_5FD78332170286C`(`caccionpersonal_id`),
    INDEX `IDX_5FD783337734155`(`eincumplimiento_id`),
    PRIMARY KEY (`eincumplimiento_id`, `caccionpersonal_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_empleado_lista_negra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `cliente_id` INTEGER NULL,
    `fecha` DATE NULL,
    `observaciones` VARCHAR(254) NULL,
    `sucursal_id` INTEGER NULL,
    `$en_cliente_completo` BOOLEAN NOT NULL,

    INDEX `IDX_69D24DF1279A5D5E`(`sucursal_id`),
    INDEX `IDX_69D24DF1952BE730`(`empleado_id`),
    INDEX `IDX_69D24DF1DE734E51`(`cliente_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_articulo_corpo_puesto_entrega` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `corpo_id` INTEGER NULL,
    `puesto_id` INTEGER NULL,
    `marca` VARCHAR(255) NOT NULL,
    `serie` VARCHAR(255) NOT NULL,
    `fechaEntrega` DATETIME(0) NOT NULL,
    `nomencladorArticuloCP_id` INTEGER NULL,

    INDEX `IDX_9BAD26993C5F34F`(`corpo_id`),
    INDEX `IDX_9BAD26995035E9DA`(`puesto_id`),
    INDEX `IDX_9BAD269985828A9B`(`nomencladorArticuloCP_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_articulo_corpo_puesto_plan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `corpo_id` INTEGER NULL,
    `puesto_id` INTEGER NULL,
    `cantidad` INTEGER NOT NULL,
    `articuloCP_id` INTEGER NULL,
    `combo_id` INTEGER NULL,

    INDEX `IDX_AAD537C43C5F34F`(`corpo_id`),
    INDEX `IDX_AAD537C45035E9DA`(`puesto_id`),
    INDEX `IDX_AAD537C4EB6587E3`(`combo_id`),
    INDEX `IDX_AAD537C4EDDDC6B`(`articuloCP_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_bonificaciones_plaza` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plaza_id` INTEGER NULL,
    `bonificacion_id` INTEGER NULL,
    `monto` DECIMAL(10, 2) NULL,
    `tipo` VARCHAR(3) NOT NULL,

    INDEX `IDX_89391A8D86CE56DC`(`bonificacion_id`),
    INDEX `IDX_89391A8DEF34C0BD`(`plaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `deleted` DATE NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_inactivacion` DATETIME(0) NULL,
    `usuario_inactivacion` VARCHAR(255) NULL,

    INDEX `IDX_AE021871521E1991`(`empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_cliente_usuario` (
    `cliente_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,

    INDEX `IDX_E039927BA76ED395`(`user_id`),
    INDEX `IDX_E039927BDE734E51`(`cliente_id`),
    PRIMARY KEY (`cliente_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_combo_articulo_cp` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` VARCHAR(255) NULL,

    UNIQUE INDEX `UNIQ_4D698C7D3A909126`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_contrato` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NULL,
    `empresa_id` INTEGER NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `nro_contrato` VARCHAR(250) NOT NULL,
    `activo` BOOLEAN NULL,
    `nro_cartel` VARCHAR(32) NULL,
    `fecha_inicio` DATE NOT NULL,
    `fecha_fin` DATE NULL,
    `vigencia` INTEGER NULL,
    `prorroga` INTEGER NULL,
    `tipoContrato_id` INTEGER NULL,
    `lugarApertura_id` INTEGER NULL,
    `division_id` INTEGER NULL,
    `document` VARCHAR(255) NULL,
    `updated_at` DATE NULL,
    `cantidad_corpos` INTEGER NOT NULL,
    `deleted` DATE NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_inactivacion` DATETIME(0) NULL,
    `usuario_inactivacion` VARCHAR(255) NULL,

    INDEX `IDX_A35EE4D41859289`(`division_id`),
    INDEX `IDX_A35EE4D4FF0676`(`tipoContrato_id`),
    INDEX `IDX_A35EE4D521E1991`(`empresa_id`),
    INDEX `IDX_A35EE4D76490E74`(`lugarApertura_id`),
    INDEX `IDX_A35EE4DDE734E51`(`cliente_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_curso_contrato` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `curso_id` INTEGER NULL,
    `contrato_id` INTEGER NULL,
    `cantidad_empleados` INTEGER NOT NULL,

    INDEX `IDX_93FF31DC70AE7BF1`(`contrato_id`),
    INDEX `IDX_93FF31DC87CB4A1F`(`curso_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_dia_excepcion_plaza` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plaza_id` INTEGER NULL,
    `tipo_turno_plan` VARCHAR(1) NULL,
    `hora_inicio_plan` TIME(0) NULL,
    `hora_fin_plan` TIME(0) NULL,
    `tipo_turno_real` VARCHAR(1) NULL,
    `hora_inicio_real` TIME(0) NULL,
    `hora_fin_real` TIME(0) NULL,
    `diaExcepcionPuesto_id` INTEGER NULL,
    `horas_duracion` DECIMAL(10, 0) NULL,
    `marcaDia_id` INTEGER NULL,

    UNIQUE INDEX `UNIQ_640C22F17963DFC5`(`marcaDia_id`),
    INDEX `IDX_640C22F132838645`(`diaExcepcionPuesto_id`),
    INDEX `IDX_640C22F1EF34C0BD`(`plaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_dia_excepcion_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `puesto_id` INTEGER NULL,
    `fecha` DATE NULL,
    `tipo_turno_plan` VARCHAR(1) NULL,
    `hora_inicio_plan` TIME(0) NULL,
    `hora_fin_plan` TIME(0) NULL,
    `tipo_turno_real` VARCHAR(1) NULL,
    `hora_inicio_real` TIME(0) NULL,
    `hora_fin_real` TIME(0) NULL,
    `observaciones` VARCHAR(254) NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_inactivacion` DATETIME(0) NULL,
    `usuario_inactivacion` VARCHAR(255) NULL,

    INDEX `IDX_1F27E2D35035E9DA`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_empleado_autorizado_contrato` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contrato_id` INTEGER NULL,
    `empleado_id` INTEGER NULL,
    `descripcion` VARCHAR(255) NULL,

    INDEX `IDX_8E302ED270AE7BF1`(`contrato_id`),
    INDEX `IDX_8E302ED2952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_empresa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `numero_patronal` VARCHAR(100) NULL,
    `tipo_patrono` VARCHAR(100) NULL,
    `cedula_juridica` VARCHAR(100) NULL,
    `segregado` VARCHAR(100) NULL,
    `sector` VARCHAR(100) NULL,
    `codigo_sucursal_ccss` VARCHAR(100) NULL,
    `deleted` DATE NULL,
    `document` VARCHAR(255) NULL,
    `updated_at` DATE NULL,
    `codigo` VARCHAR(100) NULL,
    `numero_cuenta_banco` VARCHAR(255) NOT NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_inactivacion` DATETIME(0) NULL,
    `usuario_inactivacion` VARCHAR(255) NULL,
    `numero_cliente` VARCHAR(6) NOT NULL,
    `correo` VARCHAR(64) NULL,
    `telefono` VARCHAR(32) NULL,
    `plan_banco_bac` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_historico_contrato` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contrato_id` INTEGER NULL,
    `fechaInicio` DATE NULL,
    `fechaFin` DATE NULL,
    `no_contrato` VARCHAR(255) NULL,
    `document` VARCHAR(255) NULL,
    `fecha_creado` DATE NULL,
    `tipoRegistroContrato_id` INTEGER NULL,

    INDEX `IDX_688D970F70AE7BF1`(`contrato_id`),
    INDEX `IDX_688D970F84F63C81`(`tipoRegistroContrato_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_horario_plaza_historial` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `horario_id` INTEGER NOT NULL,
    `plaza_id` INTEGER NULL,
    `fecha_inicio` DATE NOT NULL,
    `fecha_fin` DATE NULL,
    `hora_inicio` TIME(0) NULL,
    `fecha_inicio_horario` DATE NULL,

    INDEX `IDX_F4AAD92F4959F1BA`(`horario_id`),
    INDEX `IDX_F4AAD92FEF34C0BD`(`plaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_horariopuesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(100) NOT NULL,
    `fecha_activacion` DATE NOT NULL,
    `tiene_almuerzo` BOOLEAN NULL,
    `minutos_almuerzo` INTEGER NULL,
    `tipo_rotacion` VARCHAR(3) NULL,
    `deleted_at` DATE NULL,
    `inactivated_at` DATE NULL,
    `activo` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_horariopuesto_dia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `horario_id` INTEGER NULL,
    `dia` INTEGER NOT NULL,
    `hora_inicio` TIME(0) NULL,
    `hora_fin` TIME(0) NULL,
    `hora_almuerzo` TIME(0) NULL,
    `semana` INTEGER NOT NULL,
    `tipo` VARCHAR(1) NULL,
    `activo` BOOLEAN NULL,

    INDEX `IDX_2968410A4959F1BA`(`horario_id`),
    INDEX `dia_idx`(`dia`),
    INDEX `semana_idx`(`semana`),
    INDEX `tipo_idx`(`tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_plazas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `puesto_id` INTEGER NULL,
    `rol_id` INTEGER NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `nro_plaza` DECIMAL(10, 2) NULL,
    `codigo_plaza` VARCHAR(255) NULL,
    `comboUniforme_id` INTEGER NULL,
    `categoriaSalarial_id` INTEGER NULL,
    `fecha_inicio` DATE NOT NULL,
    `renov_unif` INTEGER NULL,
    `monitoreo` BOOLEAN NULL,
    `fecha_fin` DATE NULL,
    `deleted` DATE NULL,
    `tipo_contratacion` VARCHAR(3) NULL,
    `estado` VARCHAR(3) NOT NULL,
    `orden` VARCHAR(255) NULL,
    `hora_inicio` TIME(0) NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_inactivacion` DATETIME(0) NULL,
    `usuario_inactivacion` VARCHAR(255) NULL,
    `empleadoPlaza_id` INTEGER NULL,
    `maestra` BOOLEAN NULL,
    `peso` DECIMAL(10, 2) NULL,

    UNIQUE INDEX `UNIQ_92687E50BBA36FC1`(`codigo_plaza`),
    INDEX `IDX_92687E504BAB96C`(`rol_id`),
    INDEX `IDX_92687E505035E9DA`(`puesto_id`),
    INDEX `IDX_92687E5066A839D6`(`empleadoPlaza_id`),
    INDEX `IDX_92687E50A07740F`(`comboUniforme_id`),
    INDEX `IDX_92687E50F4C2234D`(`categoriaSalarial_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sucursal_id` INTEGER NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `tipoHoraExtra_id` INTEGER NULL,
    `cantidad_plazas` DECIMAL(10, 2) NOT NULL,
    `tipoPuesto_id` INTEGER NULL,
    `deleted` DATE NULL,
    `codigo` VARCHAR(255) NULL,
    `tiene_relevo` BOOLEAN NULL,
    `comboArticulosCP_id` INTEGER NULL,
    `orden` VARCHAR(255) NULL,
    `horarioPuesto_id` INTEGER NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_inactivacion` DATETIME(0) NULL,
    `usuario_inactivacion` VARCHAR(255) NULL,
    `es_cubrevacaciones` BOOLEAN NULL,
    `coordenadas_gpslat` VARCHAR(255) NULL,
    `coordenadas_gpslng` VARCHAR(255) NULL,

    UNIQUE INDEX `UNIQ_5C9F9D2020332D99`(`codigo`),
    INDEX `IDX_5C9F9D20279A5D5E`(`sucursal_id`),
    INDEX `IDX_5C9F9D202AC174D0`(`tipoPuesto_id`),
    INDEX `IDX_5C9F9D207A17505D`(`comboArticulosCP_id`),
    INDEX `IDX_5C9F9D209FF23C2C`(`horarioPuesto_id`),
    INDEX `IDX_5C9F9D20EB6A1B22`(`tipoHoraExtra_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_requerimiento_contrato` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requerimiento_id` INTEGER NULL,
    `contrato_id` INTEGER NULL,
    `tiempo_renovacion` INTEGER NULL,

    INDEX `IDX_D5DEDC5251DD0900`(`requerimiento_id`),
    INDEX `IDX_D5DEDC5270AE7BF1`(`contrato_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_estructura_sucursal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `contrato_id` INTEGER NULL,
    `nro_sucursal` VARCHAR(250) NULL,
    `provincia_id` INTEGER NULL,
    `canton_id` INTEGER NULL,
    `distrito_id` INTEGER NULL,
    `ejecutivoCuenta_id` INTEGER NULL,
    `region_id` INTEGER NULL,
    `direccion` VARCHAR(255) NULL,
    `coordenadas_gpslat` VARCHAR(255) NULL,
    `coordenadas_gpslng` VARCHAR(255) NULL,
    `cantidad_puestos` INTEGER NOT NULL,
    `deleted` DATE NULL,
    `comboArticulosCP_id` INTEGER NULL,
    `orden` INTEGER NULL,
    `permite_extras_induccion` BOOLEAN NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_inactivacion` DATETIME(0) NULL,
    `usuario_inactivacion` VARCHAR(255) NULL,

    INDEX `IDX_85C0E6384E7121AF`(`provincia_id`),
    INDEX `IDX_85C0E6385CAEAC5D`(`ejecutivoCuenta_id`),
    INDEX `IDX_85C0E63870AE7BF1`(`contrato_id`),
    INDEX `IDX_85C0E6387A17505D`(`comboArticulosCP_id`),
    INDEX `IDX_85C0E6388D070D0B`(`canton_id`),
    INDEX `IDX_85C0E63898260155`(`region_id`),
    INDEX `IDX_85C0E638E557397E`(`distrito_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_familia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `parentesco_id` INTEGER NOT NULL,
    `ocupacion_id` INTEGER NOT NULL,
    `edad` INTEGER NOT NULL,
    `nombre` VARCHAR(50) NOT NULL,
    `emergencia` BOOLEAN NOT NULL,
    `telefono` VARCHAR(255) NOT NULL,

    INDEX `IDX_BFFE2C1E5BA311FC`(`parentesco_id`),
    INDEX `IDX_BFFE2C1E952BE730`(`empleado_id`),
    INDEX `IDX_BFFE2C1ED8999C67`(`ocupacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_gasto_principal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `descripcion` VARCHAR(64) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_historia_salud` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `ultima_enfermedad` VARCHAR(64) NULL,
    `fecha_ultima_enfermedad` DATE NULL,
    `fuma` BOOLEAN NULL,
    `fuma_frecuencia` VARCHAR(32) NULL,
    `bebe` BOOLEAN NULL,
    `bebe_frecuencia` VARCHAR(32) NULL,

    INDEX `IDX_DBC9ED35952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_historia_salud_deportes` (
    `ehistoriasalud_id` INTEGER NOT NULL,
    `ndeportes_id` INTEGER NOT NULL,

    INDEX `IDX_C8CA2E312AC5252B`(`ehistoriasalud_id`),
    INDEX `IDX_C8CA2E31CE01478D`(`ndeportes_id`),
    PRIMARY KEY (`ehistoriasalud_id`, `ndeportes_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_historia_salud_juego_azar` (
    `ehistoriasalud_id` INTEGER NOT NULL,
    `njuegoazar_id` INTEGER NOT NULL,

    INDEX `IDX_A5E83ADC2AC5252B`(`ehistoriasalud_id`),
    INDEX `IDX_A5E83ADCCB6A38C4`(`njuegoazar_id`),
    PRIMARY KEY (`ehistoriasalud_id`, `njuegoazar_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_historia_salud_tipo_enfermedad` (
    `fecha` DATE NULL,
    `historiaSalud_id` INTEGER NOT NULL,
    `tipoEnfermedad_id` INTEGER NOT NULL,

    INDEX `IDX_68A643A55E542676`(`tipoEnfermedad_id`),
    INDEX `IDX_68A643A571AC4617`(`historiaSalud_id`),
    PRIMARY KEY (`historiaSalud_id`, `tipoEnfermedad_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_historia_trabajo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `momento` VARCHAR(32) NOT NULL,
    `empresa_patrono` VARCHAR(64) NULL,
    `direccion` VARCHAR(255) NULL,
    `telefono` VARCHAR(15) NULL,
    `salario` DECIMAL(10, 0) NULL,
    `nombre_jefe` VARCHAR(64) NULL,
    `puesto` VARCHAR(64) NULL,
    `fecha_inicio` DATE NOT NULL,
    `fecha_fin` DATE NOT NULL,
    `tiempo` INTEGER NOT NULL,
    `motivo_salida` VARCHAR(255) NULL,

    INDEX `IDX_C3C4D66952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_informacion_educacional` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `educacion_id` INTEGER NULL,
    `anno_inicio` INTEGER NULL,
    `anno_fin` INTEGER NULL,
    `centro_estudios` VARCHAR(64) NULL,
    `titulo` VARCHAR(64) NULL,
    `nivelEducacional_id` INTEGER NULL,

    INDEX `IDX_4ECC8A5654204EE1`(`nivelEducacional_id`),
    INDEX `IDX_4ECC8A568ED81F31`(`educacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_licencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `vence` DATE NOT NULL,
    `tipoLicencia_id` INTEGER NOT NULL,

    INDEX `IDX_209564874E5E27A4`(`tipoLicencia_id`),
    INDEX `IDX_20956487952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_otros_datos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `via_conocimiento` VARCHAR(64) NULL,
    `comentario` VARCHAR(255) NULL,
    `trabajar_por_turnos` BOOLEAN NULL,
    `trabajar_horas_extras` BOOLEAN NULL,
    `acepta_trabajo_temporal` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_persona_dependen` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parentesco_id` INTEGER NOT NULL,
    `ocupacion_id` INTEGER NOT NULL,
    `empleado_id` INTEGER NULL,
    `nombre` VARCHAR(30) NOT NULL,
    `edad` INTEGER NOT NULL,

    INDEX `IDX_708D21555BA311FC`(`parentesco_id`),
    INDEX `IDX_708D2155952BE730`(`empleado_id`),
    INDEX `IDX_708D2155D8999C67`(`ocupacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_persona_empresa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(32) NULL,
    `apellidos` VARCHAR(64) NULL,
    `tipo_relacion` VARCHAR(20) NULL,
    `otrosDatos_id` INTEGER NULL,

    INDEX `IDX_61EEE3DCA57A8FE0`(`otrosDatos_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_referencia_personal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `nombre` VARCHAR(64) NULL,
    `direccion_exacta` VARCHAR(255) NULL,
    `telefono` VARCHAR(15) NULL,

    INDEX `IDX_BFAFF6A4952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_registro_enfermedades` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `asma` BOOLEAN NOT NULL,
    `hemorragias_anormales` BOOLEAN NOT NULL,
    `problemas_lumbares` BOOLEAN NOT NULL,
    `anemia` BOOLEAN NOT NULL,
    `herpes` BOOLEAN NOT NULL,
    `problemas_neurologicos` BOOLEAN NOT NULL,
    `ansiedad` BOOLEAN NOT NULL,
    `hepatitis` BOOLEAN NOT NULL,
    `problemas_visuales` BOOLEAN NOT NULL,
    `artritis` BOOLEAN NOT NULL,
    `mareos` BOOLEAN NOT NULL,
    `problemas_renales` BOOLEAN NOT NULL,
    `cancer` BOOLEAN NOT NULL,
    `migranna` BOOLEAN NOT NULL,
    `pulmonia` BOOLEAN NOT NULL,
    `defectos_cardiacos` BOOLEAN NOT NULL,
    `presion_alta` BOOLEAN NOT NULL,
    `quimioterapia` BOOLEAN NOT NULL,
    `depresion` BOOLEAN NOT NULL,
    `presion_baja` BOOLEAN NOT NULL,
    `tuberculosis` BOOLEAN NOT NULL,
    `diabetes` BOOLEAN NOT NULL,
    `problemas_oseos` BOOLEAN NOT NULL,
    `tumores` BOOLEAN NOT NULL,
    `epilepsia` BOOLEAN NOT NULL,
    `problemas_gastrointestinales` BOOLEAN NOT NULL,
    `vih_sida` BOOLEAN NOT NULL,

    UNIQUE INDEX `UNIQ_946DE77A952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_registro_habilidades` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `cepillos_industriales` BOOLEAN NOT NULL,
    `moto_guadannas` BOOLEAN NOT NULL,
    `aspiradora_industrial` BOOLEAN NOT NULL,
    `hidrolavadora` BOOLEAN NOT NULL,
    `limpieza_alturas` BOOLEAN NOT NULL,
    `maquina_vapor` BOOLEAN NOT NULL,
    `carro` BOOLEAN NOT NULL,
    `motocicleta` BOOLEAN NOT NULL,
    `bicicleta` BOOLEAN NOT NULL,
    `equipo_computo` BOOLEAN NOT NULL,
    `ms_office` BOOLEAN NOT NULL,
    `extintores` BOOLEAN NOT NULL,
    `primeros_auxilios` BOOLEAN NOT NULL,
    `rcp` BOOLEAN NOT NULL,
    `control_acceso` BOOLEAN NOT NULL,
    `monitoreo_alarmas` BOOLEAN NOT NULL,
    `monitoreo_camaras` BOOLEAN NOT NULL,
    `escaner_cedulas` BOOLEAN NOT NULL,
    `detector_metales` BOOLEAN NOT NULL,
    `arma_fuego` BOOLEAN NOT NULL,
    `arma_no_letal` BOOLEAN NOT NULL,

    UNIQUE INDEX `UNIQ_7BA0E6E9952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_requerimiento_cumplido` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `requerimiento_id` INTEGER NOT NULL,
    `fecha_registro` DATE NULL,
    `fecha_vencimiento` DATE NULL,

    INDEX `IDX_BB503B1551DD0900`(`requerimiento_id`),
    INDEX `IDX_BB503B15952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_trabajo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_id` INTEGER NULL,
    `empleado_id` INTEGER NULL,
    `fechaTrabajo` DATE NULL,

    INDEX `IDX_1C41565B952BE730`(`empleado_id`),
    INDEX `IDX_1C41565BC2D4D747`(`nombre_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `m_comodin_ausente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `marcaDia_id` INTEGER NULL,
    `generar_accion_ausencia` BOOLEAN NULL,
    `comentarios` VARCHAR(254) NULL,

    INDEX `IDX_512A0FBD7963DFC5`(`marcaDia_id`),
    INDEX `IDX_512A0FBD952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `m_nivel_atraso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(50) NOT NULL,
    `color` VARCHAR(7) NOT NULL,
    `minutos_desde` INTEGER NOT NULL,
    `minutos_hasta` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `m_operacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha_aprobado_nivel1` DATETIME(0) NULL,
    `usuario_aprueba_nivel1` VARCHAR(50) NULL,
    `fecha_aprobado_nivel2` DATETIME(0) NULL,
    `usuario_aprueba_nivel2` VARCHAR(50) NULL,
    `comentarios` VARCHAR(254) NULL,
    `marcaDia_id` INTEGER NULL,

    INDEX `IDX_8A9E6AF37963DFC5`(`marcaDia_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `m_puesto_no_cubierto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `plaza_id` INTEGER NULL,
    `tipo` VARCHAR(3) NOT NULL,
    `fecha` DATE NOT NULL,
    `hora_inicio` TIME(0) NOT NULL,
    `hora_fin` TIME(0) NOT NULL,
    `turno` VARCHAR(1) NOT NULL,
    `horas_duracion` DECIMAL(10, 0) NULL,
    `marcaDia_id` INTEGER NULL,
    `reposicionDeHoras_id` INTEGER NULL,

    UNIQUE INDEX `UNIQ_61ED78837963DFC5`(`marcaDia_id`),
    INDEX `IDX_61ED7883952BE730`(`empleado_id`),
    INDEX `IDX_61ED7883C49D574A`(`reposicionDeHoras_id`),
    INDEX `IDX_61ED7883EF34C0BD`(`plaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `m_refuerzo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `corpo_id` INTEGER NULL,
    `fecha` DATE NOT NULL,
    `hora_inicio` TIME(0) NOT NULL,
    `hora_fin` TIME(0) NOT NULL,
    `turno` VARCHAR(1) NOT NULL,
    `marcaDia_id` INTEGER NULL,
    `horas_duracion` DECIMAL(10, 0) NULL,
    `plaza_id` INTEGER NULL,
    `tipo_refuerzo` VARCHAR(2) NOT NULL,
    `extra_id` INTEGER NULL,

    UNIQUE INDEX `UNIQ_E14C49FC7963DFC5`(`marcaDia_id`),
    UNIQUE INDEX `UNIQ_E14C49FC2B959FC6`(`extra_id`),
    INDEX `IDX_E14C49FC3C5F34F`(`corpo_id`),
    INDEX `IDX_E14C49FC952BE730`(`empleado_id`),
    INDEX `IDX_E14C49FCEF34C0BD`(`plaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `m_reposicion_de_horas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `puesto_id` INTEGER NULL,
    `fecha` DATE NOT NULL,
    `hora_inicio` TIME(0) NOT NULL,
    `hora_fin` TIME(0) NOT NULL,
    `turno` VARCHAR(1) NOT NULL,
    `horas_duracion` DECIMAL(10, 0) NULL,
    `marcaDia_id` INTEGER NULL,

    UNIQUE INDEX `UNIQ_35E7E0D47963DFC5`(`marcaDia_id`),
    INDEX `IDX_35E7E0D45035E9DA`(`puesto_id`),
    INDEX `IDX_35E7E0D4952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `m_rol_monitoreo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(50) NOT NULL,
    `observaciones` VARCHAR(254) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `m_rol_monitoreo_contrato` (
    `mrolmonitoreo_id` INTEGER NOT NULL,
    `contrato_id` INTEGER NOT NULL,

    INDEX `IDX_98623F170AE7BF1`(`contrato_id`),
    INDEX `IDX_98623F1CECCB70E`(`mrolmonitoreo_id`),
    PRIMARY KEY (`mrolmonitoreo_id`, `contrato_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `m_rol_monitoreo_sucursal` (
    `mrolmonitoreo_id` INTEGER NOT NULL,
    `sucursal_id` INTEGER NOT NULL,

    INDEX `IDX_86732B84279A5D5E`(`sucursal_id`),
    INDEX `IDX_86732B84CECCB70E`(`mrolmonitoreo_id`),
    PRIMARY KEY (`mrolmonitoreo_id`, `sucursal_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `m_turno_activo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha_inicio` DATE NOT NULL,
    `turno` VARCHAR(1) NOT NULL,
    `usuario` VARCHAR(50) NULL,
    `marcar_horario_plaza` BOOLEAN NULL,
    `motivoMarcarHorarioPlaza_id` INTEGER NULL,

    INDEX `IDX_CC1DB0AE2F4E077F`(`motivoMarcarHorarioPlaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `migration_versions` (
    `version` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`version`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_apoderado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `activo` BOOLEAN NULL,

    UNIQUE INDEX `UNIQ_2D844777952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_articulo_corpo_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `UNIQ_92DE8E473A909126`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_articulo_uniforme` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `tipoDeTalla_id` INTEGER NULL,

    UNIQUE INDEX `UNIQ_429432F03A909126`(`nombre`),
    INDEX `IDX_429432F081E7650`(`tipoDeTalla_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_banco` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NULL,
    `tamanno_numero_cuenta` INTEGER NULL,
    `identificador` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_bonificacion_plaza` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `paga_en_planilla_ordinaria` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_canton` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provincia_id` INTEGER NULL,
    `nombre` VARCHAR(64) NOT NULL,

    INDEX `IDX_9F82AC3C4E7121AF`(`provincia_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_clasificacion_referencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_clasificacion_talla` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `clasificacion_talla` VARCHAR(10) NULL,

    UNIQUE INDEX `UNIQ_B6977B853A909126`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_comprobantes_cat_sal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    `salario_base_mensual` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_coordinado_por` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_coordinador` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,
    `coordinadoPor_id` INTEGER NULL,
    `activo` BOOLEAN NULL,

    INDEX `IDX_D7D149E781B56B3`(`coordinadoPor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_deportes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_distrito` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `canton_id` INTEGER NULL,
    `nombre` VARCHAR(64) NOT NULL,

    INDEX `IDX_5A4A14868D070D0B`(`canton_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_division` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `codigo` VARCHAR(250) NULL,

    UNIQUE INDEX `UNIQ_F47A4A6F3A909126`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_educacion_primaria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NULL,
    `por_omision` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_educacion_secundaria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NULL,
    `por_omision` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_educacion_tecnico` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NULL,
    `por_omision` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_educacion_universidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NULL,
    `por_omision` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_ejecutivo_cuenta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_empresa_banco` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `banco_id` INTEGER NULL,
    `empresa_id` INTEGER NULL,
    `numero` VARCHAR(100) NOT NULL,
    `moneda` VARCHAR(20) NOT NULL,

    INDEX `IDX_F5709BC0521E1991`(`empresa_id`),
    INDEX `IDX_F5709BC0CC04A73E`(`banco_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_empresa_poliza` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `division_id` INTEGER NULL,
    `empresa_id` INTEGER NULL,
    `numero` VARCHAR(100) NOT NULL,

    INDEX `IDX_1223BAD041859289`(`division_id`),
    INDEX `IDX_1223BAD0521E1991`(`empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_escolaridad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NULL,
    `por_omision` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_estado_civil` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_horas_extras` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cantidadHoras` DECIMAL(10, 2) NOT NULL,
    `factor` DECIMAL(10, 2) NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_idioma` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_impuesto_renta_rango` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    `desde` DOUBLE NOT NULL,
    `hasta` DOUBLE NOT NULL,
    `tarifa` DOUBLE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_juego_azar` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_lugar_apertura` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_monto_comida` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `monto` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_motivo_error_asignacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_motivo_extra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `puede_pagar_comida` BOOLEAN NOT NULL,
    `tipoExtra_id` INTEGER NULL,
    `codigo_accion_personal` VARCHAR(10) NOT NULL,

    INDEX `IDX_A3B0B86EB5523D4D`(`tipoExtra_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_motivo_hora_extra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_motivo_incumplimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_motivo_marcar_horario_plaza` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_motivo_no_recontratable` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_motivo_rechazo_extra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_motivo_rechazo_solicitud_vacacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_nacionalidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_nivel_educacional` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_ocupacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_pago_turno` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `turno_id` INTEGER NULL,
    `nombre` VARCHAR(80) NOT NULL,
    `horas` INTEGER NOT NULL,
    `salario_turno` DECIMAL(10, 2) NOT NULL,
    `categoriaPlaza_id` INTEGER NULL,
    `salario_turno_dia_extra` DECIMAL(10, 2) NOT NULL,

    INDEX `IDX_971CFF176065BC38`(`categoriaPlaza_id`),
    INDEX `IDX_971CFF1769C5211E`(`turno_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_parentesco` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_periodopago` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `periodo` VARCHAR(64) NOT NULL,
    `activo` BOOLEAN NULL,
    `cantdias` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_provincia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_region` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_requerimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requerimiento_padre_id` INTEGER NULL,
    `nombre` VARCHAR(64) NOT NULL,

    INDEX `IDX_529C438AB1D10646`(`requerimiento_padre_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_salarios_minimos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `semestre` VARCHAR(255) NOT NULL,
    `salario_empleada_domestica` DECIMAL(10, 2) NOT NULL,
    `salario_miscelaneo` DECIMAL(10, 2) NOT NULL,
    `salario_oficial` DECIMAL(10, 2) NOT NULL,
    `salario_coordinador` DECIMAL(10, 2) NOT NULL,
    `activo` BOOLEAN NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_seguro_caja` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `por_ciento` DECIMAL(10, 2) NOT NULL,
    `pensionado` BOOLEAN NULL,
    `por_omision` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_sexo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(32) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_sindicato` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    `por_ciento_rebajo` DECIMAL(10, 2) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_techo_rebajo_salario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(32) NOT NULL,
    `porciento` INTEGER NOT NULL,
    `activo` BOOLEAN NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_carnet_portacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_contratacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NULL,
    `por_omision` BOOLEAN NULL,
    `codigo` VARCHAR(250) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_contrato` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_dato_adjunto_rrhh` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_deuda` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    `prioridad` INTEGER NOT NULL,
    `esDeudaConEntidad` VARCHAR(40) NOT NULL,
    `activo` BOOLEAN NOT NULL,
    `automatico` BOOLEAN NOT NULL,
    `permanente` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_enfermedad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,
    `codigo` VARCHAR(64) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_extra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `turno_completo` BOOLEAN NOT NULL,
    `paga_extra` BOOLEAN NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_licencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,
    `codigo` VARCHAR(150) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_pago_casa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_registro_contrato` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_registro_laboral` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_sancion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_trabajo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_turno` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `horas_laborables_mes` DECIMAL(10, 2) NOT NULL,
    `tipoHorarioDia` VARCHAR(2) NOT NULL,

    UNIQUE INDEX `UNIQ_9A88C29B3A909126`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `p_periodopago` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(10) NOT NULL,
    `nombre` VARCHAR(100) NOT NULL,
    `fechaInicio` DATE NOT NULL,
    `fechaFin` DATE NOT NULL,
    `activo` BOOLEAN NOT NULL,
    `periodoPagoConfig_id` INTEGER NULL,

    INDEX `IDX_31023814D035117`(`periodoPagoConfig_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `p_periodopago_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(40) NOT NULL,
    `tipo` VARCHAR(10) NOT NULL,
    `updated_at` DATE NULL,
    `observaciones` VARCHAR(254) NULL,
    `coeficiente` DECIMAL(10, 2) NULL,
    `cantidad_dias` INTEGER NOT NULL,
    `sem_dia_cierre` INTEGER NOT NULL,
    `qna1ra_dia_cierre` INTEGER NULL,
    `qna2da_dia_cierre` INTEGER NULL,
    `por_omision` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `p_planillas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATE NULL,
    `periodoPago_id` INTEGER NULL,
    `nombre` VARCHAR(100) NULL,
    `estado` VARCHAR(50) NULL,
    `fechaInicio` DATE NULL,
    `fechaFin` DATE NULL,
    `pExcelPath` VARCHAR(255) NULL,
    `pPDFPath` VARCHAR(255) NULL,
    `billExcelPath` VARCHAR(255) NULL,
    `billPDFPath` VARCHAR(255) NULL,
    `fechaTransacion` VARCHAR(50) NULL,
    `numeroTransferenciaInterna` VARCHAR(255) NULL,
    `debitoConceptoPago` VARCHAR(255) NULL,
    `$numeroCliente` VARCHAR(255) NULL,
    `archivoPlanoPath` VARCHAR(255) NULL,

    INDEX `IDX_A4977423D2624C39`(`periodoPago_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `p_planillas_bonificaciones_pagadas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bonificacion_id` INTEGER NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `planillaEmpleado_id` INTEGER NOT NULL,

    INDEX `IDX_12CD2767799EE823`(`planillaEmpleado_id`),
    INDEX `IDX_12CD276786CE56DC`(`bonificacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `p_planillas_bonificaciones_plaza_pagadas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `monto` DOUBLE NOT NULL,
    `bonificacionPlaza_id` INTEGER NULL,
    `planillaEmpleado_id` INTEGER NULL,

    INDEX `IDX_9F2F7DE7799EE823`(`planillaEmpleado_id`),
    INDEX `IDX_9F2F7DE7E084692E`(`bonificacionPlaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `p_planillas_deudas_pagadas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deuda_id` INTEGER NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `planillaEmpleado_id` INTEGER NOT NULL,

    INDEX `IDX_A96F6365799EE823`(`planillaEmpleado_id`),
    INDEX `IDX_A96F6365C5CAD3D1`(`deuda_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `p_planillas_dia_menos_descontado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(40) NOT NULL,
    `fecha_inicio` DATE NOT NULL,
    `fecha_fin` DATE NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `tipo` VARCHAR(50) NOT NULL,
    `planillaEmpleado_id` INTEGER NOT NULL,

    INDEX `IDX_DBC74561799EE823`(`planillaEmpleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `p_planillas_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `planilla_id` INTEGER NULL,
    `empleado_id` INTEGER NULL,
    `salario_seguro` DECIMAL(10, 2) NOT NULL,
    `salario_base` DECIMAL(10, 2) NOT NULL,
    `salario_bruto` DECIMAL(10, 2) NOT NULL,
    `salario_neto` DECIMAL(10, 2) NOT NULL,
    `descuento_total_dias_menos` DECIMAL(10, 2) NOT NULL,
    `decuento_renta` DECIMAL(10, 2) NOT NULL,
    `num_hediurnas` INTEGER NOT NULL,
    `imp_vacaciones` DECIMAL(10, 2) NOT NULL,
    `imp_deudas` DECIMAL(10, 2) NOT NULL,
    `imp_bonif_total` DECIMAL(10, 2) NOT NULL,
    `imp_incapacidades` DECIMAL(10, 2) NOT NULL,
    `imp_extras_otras` DECIMAL(10, 2) NOT NULL,
    `imp_total` DECIMAL(10, 2) NOT NULL,
    `imp_hediurnas` DECIMAL(10, 2) NOT NULL,
    `num_hemixtas` INTEGER NOT NULL,
    `imp_hemixtas` DECIMAL(10, 2) NOT NULL,
    `num_henocturnas` INTEGER NOT NULL,
    `imp_henocturnas` DECIMAL(10, 2) NOT NULL,
    `imp_hetotal` DECIMAL(10, 2) NOT NULL,
    `num_dias_ordinarios` DECIMAL(10, 2) NOT NULL,
    `imp_dias_ordinarios` DECIMAL(10, 2) NOT NULL,
    `salario_base_mes` DECIMAL(10, 2) NOT NULL,
    `salario_base_dia` DECIMAL(10, 2) NOT NULL,
    `salario_plaza_mes` DECIMAL(10, 2) NOT NULL,
    `salario_plaza_dia` DECIMAL(10, 2) NOT NULL,
    `imp_bonif_turno` DECIMAL(10, 2) NULL,

    INDEX `IDX_CC9DC074952BE730`(`empleado_id`),
    INDEX `IDX_CC9DC074F747F090`(`planilla_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_categoria_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(80) NOT NULL,
    `nombre` VARCHAR(80) NOT NULL,
    `salario_base_turno_semanal` DECIMAL(10, 2) NOT NULL,
    `salario_base_turno_extra_semanal` DECIMAL(10, 2) NOT NULL,
    `salario_base_mensual` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_categoria_salarial` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `clasificacion` VARCHAR(255) NOT NULL,
    `salario_mes` DECIMAL(10, 2) NULL,
    `salario_dia` DECIMAL(10, 2) NULL,
    `codigo_ocupacion` VARCHAR(100) NOT NULL,
    `salario_base_mes` DECIMAL(10, 2) NOT NULL,
    `horas_extras_diurnas` DECIMAL(10, 2) NOT NULL,
    `horas_extras_mixtas` DECIMAL(10, 2) NOT NULL,
    `horas_extras_nocturnas` DECIMAL(10, 2) NOT NULL,
    `categoriaEmpleado_id` INTEGER NULL,
    `periodo_pago` VARCHAR(255) NOT NULL,
    `fecha_inicio` DATE NULL,
    `salario_base_extras_mes` DECIMAL(10, 2) NULL,
    `is_basado_dias` BOOLEAN NULL,

    INDEX `IDX_E3A1F6CBED33694C`(`categoriaEmpleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_categoria_salarial_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `fecha_fin` DATETIME(0) NULL,
    `clasificacion` VARCHAR(255) NOT NULL,
    `salario_base_mes` DECIMAL(10, 2) NOT NULL,
    `codigo_ocupacion` VARCHAR(100) NOT NULL,
    `horas_extras_diurnas` DECIMAL(10, 2) NULL,
    `horas_extras_mixtas` DECIMAL(10, 2) NULL,
    `horas_extras_nocturnas` DECIMAL(10, 2) NULL,
    `periodo_pago` VARCHAR(255) NOT NULL,
    `categoriaEmpleado_id` INTEGER NULL,
    `categoriaSalarial_id` INTEGER NOT NULL,
    `salario_base_extras_mes` DECIMAL(10, 2) NULL,
    `fecha_insercion` DATETIME(0) NOT NULL,
    `usuario_insercion` VARCHAR(255) NOT NULL,
    `por_ajuste` BOOLEAN NULL,
    `semestre_ajuste` VARCHAR(255) NULL,
    `por_ciento_ajuste` VARCHAR(255) NULL,
    `fecha_ajuste` DATETIME(0) NULL,

    INDEX `IDX_5C4E2930ED33694C`(`categoriaEmpleado_id`),
    INDEX `IDX_5C4E2930F4C2234D`(`categoriaSalarial_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_elemento_excepcion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha_inicio` DATE NOT NULL,
    `fecha_fin` DATE NOT NULL,
    `empleado` INTEGER NULL,
    `tipo_planilla` VARCHAR(250) NULL,
    `dia_trabajado` INTEGER NULL,
    `adgcdg` INTEGER NULL,
    `repos_horas` INTEGER NULL,
    `otras_extras` INTEGER NULL,
    `feriados` INTEGER NULL,
    `deudas` INTEGER NULL,
    `rebajo_sindicato` INTEGER NULL,
    `incapacidades` INTEGER NULL,
    `bonificaciones` INTEGER NULL,
    `estado` BOOLEAN NULL,
    `refuerzos` INTEGER NULL,
    `inducciones` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_empleado_excepcion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha_inicio` DATE NOT NULL,
    `fecha_fin` DATE NOT NULL,
    `empleado` INTEGER NULL,
    `tipo_planilla` VARCHAR(250) NULL,
    `estado` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_pago_turno_semanal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    `salario_base_turno` DECIMAL(10, 2) NOT NULL,
    `tipo_turno` VARCHAR(80) NOT NULL,
    `horas_turno` DECIMAL(10, 2) NOT NULL,
    `fecha_inicio` DATE NULL,
    `categoriaEmpleado_id` INTEGER NULL,
    `salario_base_turno_extra` DECIMAL(10, 2) NOT NULL,
    `horas_extras_excepcion` DECIMAL(10, 2) NULL,

    INDEX `IDX_99D45AACED33694C`(`categoriaEmpleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_pago_turno_semanal_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    `fecha_fin` DATETIME(0) NULL,
    `salario_base_turno` DECIMAL(10, 2) NOT NULL,
    `tipo_turno` VARCHAR(80) NOT NULL,
    `horas_turno` DECIMAL(10, 2) NOT NULL,
    `pagoTurnoSemanal_id` INTEGER NOT NULL,
    `salario_base_turno_extra` DECIMAL(10, 2) NOT NULL,
    `horas_extras_excepcion` DECIMAL(10, 2) NULL,
    `categoriaEmpleado_id` INTEGER NULL,
    `fecha_insercion` DATETIME(0) NOT NULL,
    `usuario_insercion` VARCHAR(255) NOT NULL,
    `por_ajuste` BOOLEAN NULL,
    `semestre_ajuste` VARCHAR(255) NULL,
    `por_ciento_ajuste` VARCHAR(255) NULL,
    `fecha_ajuste` DATETIME(0) NULL,

    INDEX `IDX_C845571FA0E9F09B`(`pagoTurnoSemanal_id`),
    INDEX `IDX_C845571FED33694C`(`categoriaEmpleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_pe_bonif_empl_pagado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bonificacion_id` INTEGER NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `planillaEmpleado_id` INTEGER NOT NULL,

    INDEX `IDX_1ED55932799EE823`(`planillaEmpleado_id`),
    INDEX `IDX_1ED5593286CE56DC`(`bonificacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_pe_bonif_plaza_pagado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bonificacion_id` INTEGER NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `planillaEmpleado_id` INTEGER NOT NULL,

    INDEX `IDX_AB69EBC4799EE823`(`planillaEmpleado_id`),
    INDEX `IDX_AB69EBC486CE56DC`(`bonificacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_pe_deuda_descontado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deuda_id` INTEGER NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `planillaEmpleado_id` INTEGER NOT NULL,
    `cuota` DECIMAL(10, 2) NULL,

    INDEX `IDX_8BF9D6E9799EE823`(`planillaEmpleado_id`),
    INDEX `IDX_8BF9D6E9C5CAD3D1`(`deuda_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_pe_dia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dia_id` INTEGER NULL,
    `fecha` DATE NULL,
    `estado` VARCHAR(50) NULL,
    `categoria` VARCHAR(50) NULL,
    `importe_dia_ordinario` DECIMAL(10, 2) NOT NULL,
    `num_hed` DECIMAL(10, 2) NOT NULL,
    `imp_hed` DECIMAL(10, 2) NOT NULL,
    `num_hem` DECIMAL(10, 2) NOT NULL,
    `imp_hem` DECIMAL(10, 2) NOT NULL,
    `num_hen` DECIMAL(10, 2) NOT NULL,
    `imp_hen` DECIMAL(10, 2) NOT NULL,
    `bonif_turno` DECIMAL(10, 2) NOT NULL,
    `salario_plan` DECIMAL(10, 2) NOT NULL,
    `motivo_dia_menos` VARCHAR(50) NULL,
    `presente_monitoreo` BOOLEAN NULL,
    `descuento` DECIMAL(10, 2) NOT NULL,
    `monto_pagar` DECIMAL(10, 2) NOT NULL,
    `planillaEmpleado_id` INTEGER NULL,
    `hora_inicio` TIME(0) NULL,
    `hora_fin` TIME(0) NULL,
    `horas_duracion` DECIMAL(10, 0) NULL,
    `imp_rebajo` DECIMAL(10, 2) NOT NULL,
    `tipo_turno` VARCHAR(1) NULL,
    `motivo_separacion_temp` VARCHAR(5) NULL,
    `tipo_cdg` VARCHAR(10) NULL,
    `planillaEmpleadoCdg_id` INTEGER NULL,
    `horario_teorico` BOOLEAN NULL,
    `induccion` BOOLEAN NULL,
    `planillaEmpleadoRdh_id` INTEGER NULL,
    `num_horas_llt` DECIMAL(10, 2) NOT NULL,
    `num_horas_sa` DECIMAL(10, 2) NOT NULL,

    INDEX `IDX_11D3EF53436B53E8`(`planillaEmpleadoCdg_id`),
    INDEX `IDX_11D3EF53799EE823`(`planillaEmpleado_id`),
    INDEX `IDX_11D3EF53AC1F7597`(`dia_id`),
    INDEX `IDX_11D3EF53D3829280`(`planillaEmpleadoRdh_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_pe_feriado_dia_pagado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `monto` DECIMAL(10, 2) NOT NULL,
    `planillaEmpleado_id` INTEGER NOT NULL,
    `feriadoDia_id` INTEGER NULL,

    INDEX `IDX_EAF51CE1799EE823`(`planillaEmpleado_id`),
    INDEX `IDX_EAF51CE1E2194A39`(`feriadoDia_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_pe_incapacidad_pagado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `incapacidad_id` INTEGER NOT NULL,
    `monto_subsidio_pagar` DECIMAL(10, 2) NOT NULL,
    `planillaEmpleado_id` INTEGER NOT NULL,
    `dias_subsidio` INTEGER NOT NULL,

    UNIQUE INDEX `UNIQ_FEB9C1B02EDBF996`(`incapacidad_id`),
    INDEX `IDX_FEB9C1B0799EE823`(`planillaEmpleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_pe_induccion_dia_pagado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `monto` DECIMAL(10, 2) NOT NULL,
    `planillaEmpleado_id` INTEGER NOT NULL,
    `induccionDia_id` INTEGER NULL,
    `num_hed` DECIMAL(10, 2) NOT NULL,
    `imp_hed` DECIMAL(10, 2) NOT NULL,
    `num_hem` DECIMAL(10, 2) NOT NULL,
    `imp_hem` DECIMAL(10, 2) NOT NULL,
    `num_hen` DECIMAL(10, 2) NOT NULL,
    `imp_hen` DECIMAL(10, 2) NOT NULL,

    INDEX `IDX_869A86811D6FE1F6`(`induccionDia_id`),
    INDEX `IDX_869A8681799EE823`(`planillaEmpleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_pe_rebajo_sindicato_pagado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `planilla_empleado_id` INTEGER NOT NULL,
    `empleado_sindicato_id` INTEGER NOT NULL,
    `dias_subsidio` DECIMAL(18, 2) NOT NULL,
    `monto_subsidio_pagar` DECIMAL(18, 2) NOT NULL,

    INDEX `IDX_D0FCC65257F57AE7`(`planilla_empleado_id`),
    INDEX `IDX_D0FCC6526F9D0169`(`empleado_sindicato_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_pe_refuerzo_dia_pagado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `monto` DECIMAL(10, 2) NOT NULL,
    `planillaEmpleado_id` INTEGER NOT NULL,
    `refuerzoDia_id` INTEGER NULL,
    `num_hed` DECIMAL(10, 2) NOT NULL,
    `imp_hed` DECIMAL(10, 2) NOT NULL,
    `num_hem` DECIMAL(10, 2) NOT NULL,
    `imp_hem` DECIMAL(10, 2) NOT NULL,
    `num_hen` DECIMAL(10, 2) NOT NULL,
    `imp_hen` DECIMAL(10, 2) NOT NULL,

    INDEX `IDX_C5D26D6632F8140A`(`refuerzoDia_id`),
    INDEX `IDX_C5D26D66799EE823`(`planillaEmpleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_planilla` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NULL,
    `estado` VARCHAR(50) NULL,
    `fechaInicio` DATE NULL,
    `fechaFin` DATE NULL,
    `fecha_creado` DATE NULL,
    `fecha_confirmado` DATE NULL,
    `periodoPago` VARCHAR(20) NULL,
    `imp_salario_ordinario` DECIMAL(18, 2) NOT NULL,
    `imp_descuento_dias_menos` DECIMAL(18, 2) NOT NULL,
    `num_hediurnas` INTEGER NOT NULL,
    `imp_hediurnas` DECIMAL(18, 2) NOT NULL,
    `num_hemixtas` INTEGER NOT NULL,
    `imp_hemixtas` DECIMAL(18, 2) NOT NULL,
    `num_henocturnas` INTEGER NOT NULL,
    `imp_henocturnas` DECIMAL(18, 2) NOT NULL,
    `imp_extras_turno` DECIMAL(18, 2) NOT NULL,
    `imp_extras_otras` DECIMAL(18, 2) NOT NULL,
    `imp_bonif_turno` DECIMAL(18, 2) NOT NULL,
    `imp_feriado` DECIMAL(18, 2) NOT NULL,
    `imp_vacaciones` DECIMAL(18, 2) NOT NULL,
    `imp_salario_bruto` DECIMAL(18, 2) NOT NULL,
    `imp_caja` DECIMAL(18, 2) NOT NULL,
    `imp_renta` DECIMAL(18, 2) NOT NULL,
    `imp_salario_bruto_rebajado` DECIMAL(18, 2) NOT NULL,
    `imp_deudas` DECIMAL(18, 2) NOT NULL,
    `imp_incap` DECIMAL(18, 2) NOT NULL,
    `imp_bonif` DECIMAL(18, 2) NOT NULL,
    `imp_rebajo` DECIMAL(18, 2) NOT NULL,
    `num_dias_rebajo` INTEGER NOT NULL,
    `imp_salario_neto` DECIMAL(18, 2) NOT NULL,
    `imp_induccion` DECIMAL(18, 2) NOT NULL,
    `imp_salario_bruto_turno` DECIMAL(18, 2) NOT NULL,
    `num_horas_llegada_tardia` DECIMAL(10, 2) NOT NULL,
    `imp_llegada_tardia` DECIMAL(18, 2) NOT NULL,
    `num_horas_salida_anticipada` DECIMAL(10, 2) NOT NULL,
    `imp_salida_anticipada` DECIMAL(18, 2) NOT NULL,
    `imp_licencia_maternidad` DECIMAL(18, 2) NOT NULL,
    `imp_refuerzos` DECIMAL(18, 2) NOT NULL,
    `num_refuerzos` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_planilla_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `planilla_id` INTEGER NOT NULL,
    `imp_salario_total_mensual` DECIMAL(10, 2) NOT NULL,
    `imp_salario_base_mensual` DECIMAL(10, 2) NOT NULL,
    `imp_salario_diario` DECIMAL(10, 2) NOT NULL,
    `num_dias_ordinarios` DECIMAL(10, 2) NOT NULL,
    `imp_salario_ordinario` DECIMAL(10, 2) NOT NULL,
    `imp_descuento_dias_menos` DECIMAL(10, 2) NOT NULL,
    `num_hediurnas` INTEGER NOT NULL,
    `imp_hediurnas` DECIMAL(10, 2) NOT NULL,
    `num_hemixtas` INTEGER NOT NULL,
    `imp_hemixtas` DECIMAL(10, 2) NOT NULL,
    `num_henocturnas` INTEGER NOT NULL,
    `imp_henocturnas` DECIMAL(10, 2) NOT NULL,
    `imp_extras_turno` DECIMAL(10, 2) NOT NULL,
    `imp_extras_otras` DECIMAL(10, 2) NOT NULL,
    `imp_bonif_turno` DECIMAL(10, 2) NOT NULL,
    `imp_vacaciones` DECIMAL(10, 2) NOT NULL,
    `imp_salario_bruto` DECIMAL(10, 2) NOT NULL,
    `imp_caja` DECIMAL(10, 2) NOT NULL,
    `imp_renta` DECIMAL(10, 2) NOT NULL,
    `imp_salario_bruto_rebajado` DECIMAL(10, 2) NOT NULL,
    `imp_deudas` DECIMAL(10, 2) NOT NULL,
    `imp_incap` DECIMAL(10, 2) NOT NULL,
    `imp_bonif` DECIMAL(10, 2) NOT NULL,
    `imp_salario_neto` DECIMAL(10, 2) NOT NULL,
    `imp_feriado` DECIMAL(10, 2) NOT NULL,
    `imp_rebajo` DECIMAL(10, 2) NOT NULL,
    `num_dias_rebajo` INTEGER NOT NULL,
    `plaza_id` INTEGER NULL,
    `accionPersonal_id` INTEGER NULL,
    `imp_induccion` DECIMAL(10, 2) NOT NULL,
    `imp_salario_base_diario` DECIMAL(10, 2) NOT NULL,
    `imp_salario_bruto_turno` DECIMAL(10, 2) NOT NULL,
    `salarioMes_id` INTEGER NULL,
    `corpo_id` INTEGER NULL,
    `contrato_id` INTEGER NULL,
    `horario_id` INTEGER NULL,
    `num_horas_llegada_tardia` DECIMAL(10, 2) NOT NULL,
    `num_horas_salida_anticipada` DECIMAL(10, 2) NOT NULL,
    `imp_llegada_tardia` DECIMAL(10, 2) NOT NULL,
    `imp_salida_anticipada` DECIMAL(10, 2) NOT NULL,
    `cuenta_banco_activa` BOOLEAN NULL,
    `num_dias_vacaciones` INTEGER NULL,
    `num_dias_licencia_maternidad` INTEGER NULL,
    `num_otras_x33` DECIMAL(10, 2) NULL,
    `imp_otras_x33` DECIMAL(10, 2) NULL,
    `num_otras_hediurnas` DECIMAL(10, 2) NULL,
    `imp_otras_hediurnas` DECIMAL(10, 2) NULL,
    `num_otras_hemixtas` DECIMAL(10, 2) NULL,
    `imp_otras_hemixtas` DECIMAL(10, 2) NULL,
    `num_otras_henocturnas` DECIMAL(10, 2) NULL,
    `imp_otras_henocturnas` DECIMAL(10, 2) NULL,
    `imp_licencia_maternidad` DECIMAL(10, 2) NOT NULL,
    `accionPersonalLicenciaMaternidad_id` INTEGER NULL,
    `estado` VARCHAR(50) NULL,
    `imp_refuerzo` DECIMAL(10, 2) NOT NULL,
    `num_refuerzos` DECIMAL(10, 2) NOT NULL,
    `num_induccion` DECIMAL(10, 2) NOT NULL,
    `info_ultima_semana` LONGTEXT NULL,

    INDEX `IDX_1465F95E10B18851`(`accionPersonalLicenciaMaternidad_id`),
    INDEX `IDX_1465F95E3C5F34F`(`corpo_id`),
    INDEX `IDX_1465F95E4558C79`(`accionPersonal_id`),
    INDEX `IDX_1465F95E4959F1BA`(`horario_id`),
    INDEX `IDX_1465F95E70AE7BF1`(`contrato_id`),
    INDEX `IDX_1465F95E952BE730`(`empleado_id`),
    INDEX `IDX_1465F95EB1C7830E`(`salarioMes_id`),
    INDEX `IDX_1465F95EEF34C0BD`(`plaza_id`),
    INDEX `IDX_1465F95EF747F090`(`planilla_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_planilla_extra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NULL,
    `fecha_elaboracion` DATETIME(0) NULL,
    `fecha_confirmacion` DATETIME(0) NULL,
    `fecha_inicio` DATE NULL,
    `fecha_fin` DATE NULL,
    `tipo` VARCHAR(20) NULL,
    `estado` VARCHAR(20) NULL,
    `empresa_id` INTEGER NULL,
    `banco_id` INTEGER NULL,

    INDEX `IDX_3764CFDF521E1991`(`empresa_id`),
    INDEX `IDX_3764CFDFCC04A73E`(`banco_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_planilla_extra_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `plaza_id` INTEGER NULL,
    `planilla_id` INTEGER NULL,
    `salario_bruto` DECIMAL(10, 2) NOT NULL,
    `decuento_renta` DECIMAL(10, 2) NOT NULL,
    `descuento_caja` DECIMAL(10, 2) NOT NULL,
    `salario_neto` DECIMAL(10, 2) NOT NULL,
    `empresa_id` INTEGER NULL,
    `banco_id` INTEGER NULL,
    `cuenta_banco_activa` BOOLEAN NULL,

    INDEX `IDX_F9A77EA2521E1991`(`empresa_id`),
    INDEX `IDX_F9A77EA2952BE730`(`empleado_id`),
    INDEX `IDX_F9A77EA2CC04A73E`(`banco_id`),
    INDEX `IDX_F9A77EA2EF34C0BD`(`plaza_id`),
    INDEX `IDX_F9A77EA2F747F090`(`planilla_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_salario_minimo_semestre` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `semestre` VARCHAR(255) NOT NULL,
    `aumento_por_ciento` DECIMAL(10, 6) NOT NULL,
    `salario_mes_empleada_domestica` DECIMAL(10, 2) NOT NULL,
    `salario_mes_miscelaneo` DECIMAL(10, 2) NOT NULL,
    `salario_mes_oficial` DECIMAL(10, 2) NOT NULL,
    `salario_mes_coordinador` DECIMAL(10, 2) NOT NULL,
    `activo` BOOLEAN NOT NULL,
    `salario_dia_empleada_domestica` DECIMAL(10, 2) NOT NULL,
    `salario_dia_miscelaneo` DECIMAL(10, 2) NOT NULL,
    `salario_dia_oficial` DECIMAL(10, 2) NOT NULL,
    `salario_dia_coordinador` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pg_turno_excepcion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo_turno` VARCHAR(1) NOT NULL,
    `cantidad_horas` DECIMAL(10, 2) NOT NULL,
    `tipo_excepcion` VARCHAR(3) NOT NULL,
    `horas_extra_excepcion` DECIMAL(10, 2) NOT NULL,
    `categoriaSalarial_id` INTEGER NULL,

    INDEX `IDX_9DAD81FEF4C2234D`(`categoriaSalarial_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nacionalidad_id` INTEGER NULL,
    `sindicato_id` INTEGER NULL,
    `banco_id` INTEGER NULL,
    `escolaridad_id` INTEGER NULL,
    `codigo` VARCHAR(30) NOT NULL,
    `nombre` VARCHAR(32) NULL,
    `primer_apellido` VARCHAR(32) NULL,
    `segundo_apellido` VARCHAR(32) NULL,
    `cedula` VARCHAR(64) NOT NULL,
    `sexo` VARCHAR(1) NULL,
    `salario` DECIMAL(10, 0) NULL,
    `talla_calzado` VARCHAR(10) NULL,
    `talla_pantalon` VARCHAR(10) NULL,
    `talla_camisa` VARCHAR(10) NULL,
    `talla_camiseta` VARCHAR(10) NULL,
    `talla_jacket` VARCHAR(10) NULL,
    `peso` INTEGER NULL,
    `estatura` INTEGER NULL,
    `Email` VARCHAR(52) NULL,
    `telefono` VARCHAR(255) NULL,
    `telefono_otro` VARCHAR(255) NULL,
    `celular` VARCHAR(255) NULL,
    `tipoCedula` VARCHAR(255) NULL,
    `fechaVencimientoCedula` DATE NULL,
    `fechaNacimiento` DATE NULL,
    `cantidad_deuda` DECIMAL(10, 0) NULL,
    `otro_ingreso` VARCHAR(52) NULL,
    `domicilio` VARCHAR(255) NULL,
    `fecha_contratacion` DATE NULL,
    `numero_seguro_social` VARCHAR(32) NULL,
    `pensionado` BOOLEAN NULL,
    `numero_hijos` INTEGER NULL,
    `banco_nro_cuenta` VARCHAR(255) NULL,
    `fecha_psicologico_vence` DATE NULL,
    `fecha_portacion_vence` DATE NULL,
    `es_comodin` BOOLEAN NULL,
    `importacionEmpleados_id` INTEGER NOT NULL,
    `empleadoAsociado_id` INTEGER NULL,
    `tipoPagoCasa_id` INTEGER NULL,
    `estadoCivil_id` INTEGER NULL,
    `periodoPago_id` INTEGER NULL,
    `seguroCaja_id` INTEGER NULL,
    `categoriaEmpleado_id` INTEGER NULL,
    `educacionPrimaria_id` INTEGER NULL,
    `educacionSecundaria_id` INTEGER NULL,
    `educacionTecnico_id` INTEGER NULL,
    `educacionUniversidad_id` INTEGER NULL,
    `tipoContratacion_id` INTEGER NULL,
    `categoria_original` VARCHAR(255) NULL,
    `provincia` VARCHAR(255) NULL,
    `canton` VARCHAR(255) NULL,
    `distrito` VARCHAR(255) NULL,
    `region` VARCHAR(255) NULL,
    `corpo_codigo` VARCHAR(100) NULL,
    `corpo_nombre` VARCHAR(255) NULL,
    `sociedad` VARCHAR(255) NULL,
    `estado_diferencias` VARCHAR(20) NULL,
    `estado_sincronizacion` VARCHAR(20) NULL,
    `errores_sincronizacion` VARCHAR(255) NULL,
    `cambios` LONGTEXT NULL,
    `codigo_en_planilla` VARCHAR(30) NULL,

    INDEX `IDX_EFE4B871114FAA7C`(`educacionTecnico_id`),
    INDEX `IDX_EFE4B87128F0D5CA`(`escolaridad_id`),
    INDEX `IDX_EFE4B8712BAEF284`(`estadoCivil_id`),
    INDEX `IDX_EFE4B87155CD1AE4`(`educacionUniversidad_id`),
    INDEX `IDX_EFE4B8715EEC5E1B`(`educacionPrimaria_id`),
    INDEX `IDX_EFE4B87179F98940`(`seguroCaja_id`),
    INDEX `IDX_EFE4B8718D7C55D2`(`sindicato_id`),
    INDEX `IDX_EFE4B8719297142`(`empleadoAsociado_id`),
    INDEX `IDX_EFE4B871996BD967`(`educacionSecundaria_id`),
    INDEX `IDX_EFE4B871AB8DC0F8`(`nacionalidad_id`),
    INDEX `IDX_EFE4B871B0B41592`(`tipoContratacion_id`),
    INDEX `IDX_EFE4B871B7B147D6`(`importacionEmpleados_id`),
    INDEX `IDX_EFE4B871CC04A73E`(`banco_id`),
    INDEX `IDX_EFE4B871D2624C39`(`periodoPago_id`),
    INDEX `IDX_EFE4B871ED33694C`(`categoriaEmpleado_id`),
    INDEX `IDX_EFE4B871FCBB0AEC`(`tipoPagoCasa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_empleado_plaza` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `plaza_id` INTEGER NULL,
    `codigo_empleado` VARCHAR(255) NOT NULL,
    `cedula_empleado` VARCHAR(255) NOT NULL,
    `codigo_plaza` VARCHAR(255) NOT NULL,
    `nombre_plaza` VARCHAR(255) NOT NULL,
    `status` INTEGER NOT NULL,
    `error` LONGTEXT NULL,

    UNIQUE INDEX `UNIQ_79220E13EF34C0BD`(`plaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_importacion_empleados` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha_importacion` DATE NULL,
    `fecha_creado` DATE NULL,
    `usuario_insercion` VARCHAR(255) NOT NULL,
    `observaciones` VARCHAR(254) NULL,
    `num_empleados_activos_segar` INTEGER NULL,
    `inserciones` INTEGER NULL,
    `modificaciones` INTEGER NULL,
    `eliminaciones` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_planilla` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NULL,
    `fechaInicio` DATE NULL,
    `fechaFin` DATE NULL,
    `fecha_creado` DATE NULL,
    `diasordinarios_cantidad` DECIMAL(10, 2) NULL,
    `diasordinarios_monto` DOUBLE NULL,
    `hed_cantidad` DECIMAL(10, 2) NULL,
    `hed_monto` DECIMAL(10, 2) NULL,
    `hem_cantidad` DECIMAL(10, 2) NULL,
    `hem_monto` DECIMAL(10, 2) NULL,
    `hen_cantidad` DECIMAL(10, 2) NULL,
    `hen_monto` DECIMAL(10, 2) NULL,
    `feriado_cantidad` DECIMAL(10, 2) NULL,
    `feriado_monto` DECIMAL(10, 2) NULL,
    `vacacion_cantidad` DECIMAL(10, 2) NULL,
    `vacacion_monto` DECIMAL(10, 2) NULL,
    `bonificacion_monto` DECIMAL(10, 2) NULL,
    `subsidio_cantidad` DECIMAL(10, 2) NULL,
    `subsidio_monto` DECIMAL(10, 2) NULL,
    `llegadastardias_monto` DECIMAL(10, 2) NULL,
    `llegadastardias_horas` DECIMAL(10, 2) NULL,
    `rebajos` DECIMAL(10, 2) NULL,
    `ccss` DECIMAL(10, 2) NULL,
    `retencionesrenta` DECIMAL(10, 2) NULL,
    `embargos` DECIMAL(10, 2) NULL,
    `pensionsalimenticia` DECIMAL(10, 2) NULL,
    `examenpsicologico` DECIMAL(10, 2) NULL,
    `dictamenmedico` DECIMAL(10, 2) NULL,
    `rebajodanoequipo` DECIMAL(10, 2) NULL,
    `rebajoprestamotercero` DECIMAL(10, 2) NULL,
    `anticipossalariales` DECIMAL(10, 2) NULL,
    `rebajofuneraria` DECIMAL(10, 2) NULL,
    `rebajouniforme` DECIMAL(10, 2) NULL,
    `rebajoindicato` DECIMAL(10, 2) NULL,
    `otrosrebajos` DECIMAL(10, 2) NULL,
    `salario_bruto` DOUBLE NULL,
    `total_retenciones` DOUBLE NULL,
    `salario_neto` DOUBLE NULL,
    `usuario_insercion` VARCHAR(255) NOT NULL,
    `comentarios` VARCHAR(254) NULL,
    `directorio_descarga` VARCHAR(254) NULL,
    `mail_notified_at` DATETIME(0) NULL,
    `empresa_id` INTEGER NULL,

    INDEX `IDX_A2ED8530521E1991`(`empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `security_fos_group` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `roles` LONGTEXT NOT NULL,

    UNIQUE INDEX `UNIQ_23BF45A45E237E06`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `security_fos_user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(255) NOT NULL,
    `username_canonical` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `email_canonical` VARCHAR(255) NOT NULL,
    `enabled` BOOLEAN NOT NULL,
    `salt` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `last_login` DATETIME(0) NULL,
    `locked` BOOLEAN NOT NULL,
    `expires_at` DATETIME(0) NULL,
    `confirmation_token` VARCHAR(255) NULL,
    `password_requested_at` DATETIME(0) NULL,
    `roles` LONGTEXT NOT NULL,
    `credentials_expire_at` DATETIME(0) NULL,
    `nombres` VARCHAR(64) NOT NULL,
    `apellidos` VARCHAR(64) NULL,
    `ejecutivoCuenta_id` INTEGER NULL,
    `acceso_empleados_no_contratados` BOOLEAN NULL,
    `revertir_acciones_inc_anteriores` BOOLEAN NULL,
    `permisos_aprobacion` LONGTEXT NULL,
    `security_flag` BOOLEAN NULL,
    `coordinador_id` INTEGER NULL,
    `coordinadoPor_id` INTEGER NULL,
    `permiso_marcar_horario_plaza` BOOLEAN NULL,
    `permiso_limite_extras_semanal` BOOLEAN NULL,
    `password_expires_at` DATETIME(0) NULL,

    UNIQUE INDEX `UNIQ_F611E3AB92FC23A8`(`username_canonical`),
    UNIQUE INDEX `UNIQ_F611E3ABA0D96FBF`(`email_canonical`),
    INDEX `IDX_F611E3AB5CAEAC5D`(`ejecutivoCuenta_id`),
    INDEX `IDX_F611E3AB81B56B3`(`coordinadoPor_id`),
    INDEX `IDX_F611E3ABE4517BDD`(`coordinador_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `security_fos_users_divisiones` (
    `user_id` INTEGER NOT NULL,
    `ndivision_id` INTEGER NOT NULL,

    INDEX `IDX_ECB7EF6390B45A1C`(`ndivision_id`),
    INDEX `IDX_ECB7EF63A76ED395`(`user_id`),
    PRIMARY KEY (`user_id`, `ndivision_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `security_fos_users_groups` (
    `user_id` INTEGER NOT NULL,
    `group_id` INTEGER NOT NULL,

    INDEX `IDX_195E7B04A76ED395`(`user_id`),
    INDEX `IDX_195E7B04FE54D947`(`group_id`),
    PRIMARY KEY (`user_id`, `group_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `security_fos_users_roles_monitoreo` (
    `user_id` INTEGER NOT NULL,
    `mrolmonitoreo_id` INTEGER NOT NULL,

    INDEX `IDX_6B6023C2A76ED395`(`user_id`),
    INDEX `IDX_6B6023C2CECCB70E`(`mrolmonitoreo_id`),
    PRIMARY KEY (`user_id`, `mrolmonitoreo_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `security_fos_users_roles_tipoaccion` (
    `user_id` INTEGER NOT NULL,
    `croltipoaccion_id` INTEGER NOT NULL,

    INDEX `IDX_D81D1251A76ED395`(`user_id`),
    INDEX `IDX_D81D1251C9F2F869`(`croltipoaccion_id`),
    PRIMARY KEY (`user_id`, `croltipoaccion_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v_planilla_aguinaldo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NULL,
    `nombre` VARCHAR(100) NULL,
    `fechaInicio` DATE NULL,
    `fechaFin` DATE NULL,
    `fecha_creado` DATE NULL,
    `usuario_insercion` VARCHAR(255) NOT NULL,
    `comentarios` VARCHAR(254) NULL,
    `importado` BOOLEAN NULL,
    `periodo` VARCHAR(254) NULL,

    INDEX `IDX_349B745C521E1991`(`empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v_planilla_aguinaldo_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `comentarios` VARCHAR(254) NULL,
    `planillaAguinaldo_id` INTEGER NULL,
    `ene` DECIMAL(10, 2) NULL,
    `feb` DECIMAL(10, 2) NULL,
    `mar` DECIMAL(10, 2) NULL,
    `abr` DECIMAL(10, 2) NULL,
    `may` DECIMAL(10, 2) NULL,
    `jun` DECIMAL(10, 2) NULL,
    `jul` DECIMAL(10, 2) NULL,
    `ago` DECIMAL(10, 2) NULL,
    `sep` DECIMAL(10, 2) NULL,
    `oct` DECIMAL(10, 2) NULL,
    `nov` DECIMAL(10, 2) NULL,
    `dic` DECIMAL(10, 2) NULL,

    INDEX `IDX_3941B047952BE730`(`empleado_id`),
    INDEX `IDX_3941B047D45EF842`(`planillaAguinaldo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v_salario_mes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `fecha` DATE NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `cantidad_periodos` SMALLINT NOT NULL,
    `es_carga_inicial` BOOLEAN NULL,
    `planillaAguinaldoEmpleado_id` INTEGER NULL,

    INDEX `IDX_E9F02E60952BE730`(`empleado_id`),
    INDEX `IDX_E9F02E60ACF1D1A2`(`planillaAguinaldoEmpleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v_vacacion_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `fecha_saldo` DATE NOT NULL,
    `saldo` DECIMAL(10, 2) NULL,
    `puedo_disfrutar` BOOLEAN NULL,
    `alerta_no_disfrute` BOOLEAN NULL,
    `alerta_dos_peridos` BOOLEAN NULL,
    `fecha_contratacion` DATE NULL,

    INDEX `IDX_50A3975A952BE730`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v_vacacion_mes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` DATE NOT NULL,
    `es_carga_inicial` BOOLEAN NULL,
    `dias_saldo_inicial` INTEGER NOT NULL,
    `dias_disfrute` INTEGER NOT NULL,
    `dias_pago` INTEGER NOT NULL,
    `dias_derecho_mes` INTEGER NOT NULL,
    `dias_ajuste` INTEGER NOT NULL,
    `dias_saldo_final` INTEGER NOT NULL,
    `vacacionEmpleado_id` INTEGER NULL,
    `motivo_ajuste` VARCHAR(100) NULL,

    INDEX `IDX_5B04062661CD3BE2`(`vacacionEmpleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v_vacacion_solicitud` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `plaza_id` INTEGER NULL,
    `fecha_inicio` DATE NOT NULL,
    `fecha_fin` DATE NULL,
    `dias` INTEGER NOT NULL,
    `semanas` INTEGER NOT NULL,
    `observaciones` VARCHAR(254) NULL,
    `monto` DECIMAL(10, 2) NULL,
    `consecutivo` VARCHAR(15) NULL,
    `estado_aprobacion` VARCHAR(30) NULL,
    `fecha_aprobado_ec` DATETIME(0) NULL,
    `usuario_aprueba_ec` VARCHAR(50) NULL,
    `fecha_aprobado_ge` DATETIME(0) NULL,
    `usuario_aprueba_ge` VARCHAR(50) NULL,
    `accionPersonal_id` INTEGER NULL,
    `tipo_vacaciones` VARCHAR(10) NULL,
    `periodoPago_id` INTEGER NULL,
    `periodo` VARCHAR(255) NULL,
    `fecha_insercion` DATETIME(0) NULL,
    `usuario_insercion` VARCHAR(255) NULL,
    `fecha_actualizacion` DATETIME(0) NULL,
    `usuario_actualizacion` VARCHAR(255) NULL,
    `fecha_reversion` DATETIME(0) NULL,
    `usuario_reversion` VARCHAR(255) NULL,
    `motivo_reversion` VARCHAR(255) NULL,
    `solicitado_por_empleado` BOOLEAN NULL,
    `observaciones_rechazo` VARCHAR(255) NULL,
    `motivoRechazo_id` INTEGER NULL,
    `sustituto_id` INTEGER NULL,
    `coordinador_id` INTEGER NULL,
    `coordinadoPor_id` INTEGER NULL,
    `pago_periodos_consecutivos` BOOLEAN NULL,

    UNIQUE INDEX `UNIQ_98808EDA4558C79`(`accionPersonal_id`),
    INDEX `IDX_98808EDA6D3EA93A`(`sustituto_id`),
    INDEX `IDX_98808EDA7F5F4055`(`motivoRechazo_id`),
    INDEX `IDX_98808EDA81B56B3`(`coordinadoPor_id`),
    INDEX `IDX_98808EDA952BE730`(`empleado_id`),
    INDEX `IDX_98808EDAD2624C39`(`periodoPago_id`),
    INDEX `IDX_98808EDAE4517BDD`(`coordinador_id`),
    INDEX `IDX_98808EDAEF34C0BD`(`plaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `a_recovery_password_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `expira_en` INTEGER NOT NULL,
    `creacion` DATETIME(0) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `empleadoId` INTEGER NOT NULL,

    INDEX `FK_E35A23BC952BE730`(`empleadoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_acta_entre_producto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `contrato_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tipo_entrega` LONGTEXT NOT NULL,
    `mensual` LONGTEXT NOT NULL,
    `division` VARCHAR(25) NOT NULL,
    `detalle` LONGTEXT NOT NULL,
    `observaciones` LONGTEXT NOT NULL,
    `nombre_entrega` LONGTEXT NOT NULL,
    `cedula_entrega` VARCHAR(30) NOT NULL,
    `fecha_entrega` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `firma_entrega` LONGTEXT NOT NULL,
    `nombre_recibe` LONGTEXT NOT NULL,
    `cedula_recibe` VARCHAR(30) NOT NULL,
    `fecha_recibe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `firma_recibe` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `division_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_agenda_minuta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `numero` INTEGER NOT NULL,
    `titulo` VARCHAR(255) NOT NULL,
    `fecha` DATE NOT NULL,
    `hora_inicio` TIME(0) NOT NULL,
    `hora_fin` TIME(0) NOT NULL,
    `autor` LONGTEXT NOT NULL,
    `participantes` LONGTEXT NOT NULL,
    `acuerdos` LONGTEXT NOT NULL,
    `observaciones` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NOT NULL,
    `temas_a_tratar` LONGTEXT NULL,

    INDEX `c_agenda_minuta_cliente_id_fkey`(`cliente_id`),
    INDEX `c_agenda_minuta_corpo_id_fkey`(`corpo_id`),
    INDEX `c_agenda_minuta_puesto_id_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_anexos_quejas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `original_name` LONGTEXT NOT NULL,
    `type` VARCHAR(25) NOT NULL,
    `extension` VARCHAR(25) NOT NULL,
    `queja_id` INTEGER NOT NULL,

    INDEX `c_anexos_quejas_queja_id_fkey`(`queja_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_apertura_cierre_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `actividades` LONGTEXT NOT NULL,
    `inventario` LONGTEXT NOT NULL,
    `otras_observaciones` LONGTEXT NULL,
    `nombre_representante_cliente` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `firma_representante_empresa_entrante` LONGTEXT NOT NULL,
    `firma_representante_empresa_saliente` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `nombre_representante_empresa_entrante` VARCHAR(255) NOT NULL,
    `nombre_representante_empresa_saliente` VARCHAR(255) NOT NULL,
    `firma_representante_cliente` LONGTEXT NOT NULL,
    `division_id` INTEGER NOT NULL,

    INDEX `c_apertura_cierre_puesto_cliente_id_fkey`(`cliente_id`),
    INDEX `c_apertura_cierre_puesto_corpo_id_fkey`(`corpo_id`),
    INDEX `c_apertura_cierre_puesto_division_id_fkey`(`division_id`),
    INDEX `c_apertura_cierre_puesto_puesto_id_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_archivos_adjuntos_articulo_mantenimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `original_name` LONGTEXT NOT NULL,
    `type` VARCHAR(25) NOT NULL,
    `extension` VARCHAR(25) NOT NULL,
    `activo_mantenimiento_id` INTEGER NOT NULL,

    INDEX `c_archivos_adjuntos_articulo_mantenimiento_activo_mantenimi_fkey`(`activo_mantenimiento_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_archivos_aporte_incidente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `original_name` LONGTEXT NOT NULL,
    `type` VARCHAR(25) NOT NULL,
    `extension` VARCHAR(25) NOT NULL,
    `contribucion_id` INTEGER NOT NULL,

    INDEX `c_archivos_aporte_incidente_contribucion_id_fkey`(`contribucion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_archivos_incidente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `original_name` LONGTEXT NOT NULL,
    `type` VARCHAR(25) NOT NULL,
    `extension` VARCHAR(25) NOT NULL,
    `incidente_id` INTEGER NOT NULL,

    INDEX `c_archivos_incidente_incidente_id_fkey`(`incidente_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_articulo_mantenimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `articulo_plan_id` INTEGER NULL,
    `articulo_asignado_id` INTEGER NULL,
    `estado` VARCHAR(55) NOT NULL,
    `cantidad_necesaria` INTEGER NOT NULL,
    `cantidad_real` INTEGER NOT NULL,
    `observaciones` LONGTEXT NOT NULL,
    `fecha_solucion` DATETIME(0) NULL,
    `accion` VARCHAR(55) NULL,
    `fecha_inicio` DATETIME(0) NULL,
    `numero_boleta_proveeduria` LONGTEXT NULL,
    `tipo` LONGTEXT NULL,
    `marca` LONGTEXT NULL,
    `modelo` LONGTEXT NULL,
    `serie_placa` LONGTEXT NULL,
    `marca_nuevo` LONGTEXT NULL,
    `modelo_nuevo` LONGTEXT NULL,
    `serie_placa_nuevo` LONGTEXT NULL,
    `categoria` LONGTEXT NULL,
    `tipo_mantenimiento_art` LONGTEXT NULL,
    `fecha_salida` DATETIME(0) NULL,
    `fecha_entrada` DATETIME(0) NULL,
    `kilometraje` INTEGER NULL,
    `mant_armas_form` LONGTEXT NULL,
    `categoria_mantinimiento` LONGTEXT NULL,
    `detalle` LONGTEXT NULL,
    `numero_fc` LONGTEXT NULL,
    `proveedor` LONGTEXT NULL,
    `costo_mo` INTEGER NULL,
    `costo_i` INTEGER NULL,
    `iva` INTEGER NULL,
    `costo_total` INTEGER NULL,
    `fecha_fin` DATETIME(0) NULL,
    `reincidencia_treinta_dias` BOOLEAN NULL,
    `tipo_mant_art_reincid` LONGTEXT NULL,

    INDEX `c_articulo_mantenimiento_articulo_asignado_id_fkey`(`articulo_asignado_id`),
    INDEX `c_articulo_mantenimiento_articulo_plan_id_fkey`(`articulo_plan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_bitacora_vehiculo_detenido` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(52) NOT NULL,
    `informacion_general` LONGTEXT NOT NULL,
    `informacion_revision` LONGTEXT NOT NULL,
    `movimientos_vehiculos` LONGTEXT NOT NULL,
    `observaciones` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `empresa_id` INTEGER NOT NULL,
    `sucursal_id` INTEGER NOT NULL,
    `uso_id` INTEGER NULL,
    `vehiculo_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_boleta_apreciacion_vulnerabilidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `fecha` DATETIME(0) NOT NULL,
    `enlace` VARCHAR(255) NOT NULL,
    `nombre_solicitante` VARCHAR(255) NOT NULL,
    `boleta` LONGTEXT NOT NULL,
    `metricas_vulnerablidad` LONGTEXT NOT NULL,
    `observaciones` LONGTEXT NULL,
    `firma_solicitante` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,

    INDEX `c_boleta_apreciacion_vulnerabilidad_cliente_id_fkey`(`cliente_id`),
    INDEX `c_boleta_apreciacion_vulnerabilidad_corpo_id_fkey`(`corpo_id`),
    INDEX `c_boleta_apreciacion_vulnerabilidad_puesto_id_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_cambios_apps_modules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_tabla` LONGTEXT NOT NULL,
    `registro_id` INTEGER NOT NULL,
    `cambios` LONGTEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `created_by` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_categoria_mantenimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_checklist_supervision` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `division_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `ejecutivo_cuenta` VARCHAR(55) NOT NULL,
    `evaluacion` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `fecha` DATETIME(0) NOT NULL,
    `firma_supervisor` LONGTEXT NOT NULL,
    `articulos_puesto` LONGTEXT NOT NULL,

    INDEX `c_checklist_supervision_cliente_id_fkey`(`cliente_id`),
    INDEX `c_checklist_supervision_corpo_id_fkey`(`corpo_id`),
    INDEX `c_checklist_supervision_puesto_id_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_contribucion_incidente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `incidente_id` INTEGER NOT NULL,
    `empleado_id` INTEGER NOT NULL,
    `aporte` LONGTEXT NOT NULL,
    `rol_aporte` VARCHAR(25) NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `firma_aporte_tercero` LONGTEXT NULL,
    `nombre_aporte` VARCHAR(191) NULL,

    INDEX `c_contribucion_incidente_empleado_id_fkey`(`empleado_id`),
    INDEX `c_contribucion_incidente_incidente_id_fkey`(`incidente_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_control_asistencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `contrato_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `turno` VARCHAR(191) NOT NULL,
    `area_piso` VARCHAR(191) NOT NULL,
    `total_presentes` INTEGER NOT NULL,
    `fijos` INTEGER NOT NULL,
    `colaboradores` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` INTEGER NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `nombre_cliente` VARCHAR(191) NOT NULL,
    `division_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_empleado_almuerzo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `pausas` LONGTEXT NOT NULL,
    `inicio` DATETIME(0) NOT NULL,
    `fin` DATETIME(0) NOT NULL,
    `es_manual` BOOLEAN NOT NULL DEFAULT false,

    INDEX `empleadoId_almuerzo_fkey`(`empleadoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_empleado_notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `notificationId` INTEGER NOT NULL,
    `watched` BOOLEAN NOT NULL DEFAULT false,

    INDEX `c_empleado_notification_notificationId_fkey`(`notificationId`),
    INDEX `c_plaza_notification_empleadoId_fkey`(`empleadoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_encuesta_cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `division_id` INTEGER NOT NULL,
    `responsable_id` INTEGER NOT NULL,
    `fecha` DATE NOT NULL,
    `evaluaciones` LONGTEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `nombre_evaluado` VARCHAR(45) NOT NULL,
    `cedula_evaluado` VARCHAR(25) NOT NULL,
    `cedula_responsable` VARCHAR(25) NOT NULL,
    `nombre_responsable` VARCHAR(45) NOT NULL,
    `email_evaluado` VARCHAR(50) NOT NULL,
    `firma_evaluado` LONGTEXT NOT NULL,
    `telefono_evaluado` VARCHAR(25) NOT NULL,
    `empresa_evaluado` VARCHAR(55) NOT NULL,
    `observaciones` LONGTEXT NOT NULL,

    INDEX `c_encuesta_cliente_cliente_id_fkey`(`cliente_id`),
    INDEX `c_encuesta_cliente_corpo_id_fkey`(`corpo_id`),
    INDEX `c_encuesta_cliente_division_id_fkey`(`division_id`),
    INDEX `c_encuesta_cliente_empresa_id_fkey`(`empresa_id`),
    INDEX `c_encuesta_cliente_puesto_id_fkey`(`puesto_id`),
    INDEX `c_encuesta_cliente_responsable_id_fkey`(`responsable_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_evaluacion_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_empleado` VARCHAR(45) NOT NULL,
    `cedula_empleado` VARCHAR(45) NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `plaza_id` INTEGER NOT NULL,
    `empleado_id` INTEGER NOT NULL,
    `evaluador_id` INTEGER NOT NULL,
    `tipo` VARCHAR(25) NOT NULL,
    `fecha_ingreso` DATE NOT NULL,
    `fecha_evaluacion` DATE NOT NULL,
    `evaluacion` LONGTEXT NOT NULL,
    `comentarios` LONGTEXT NOT NULL,
    `nombre_evaluador` VARCHAR(45) NOT NULL,
    `firma_evaluador` LONGTEXT NOT NULL,
    `firma_empleado` LONGTEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `firma_empleado_manual` LONGTEXT NULL,

    INDEX `c_evaluacion_empleado_corpo_id_fkey`(`corpo_id`),
    INDEX `c_evaluacion_empleado_plaza_id_fkey`(`plaza_id`),
    INDEX `c_evaluacion_empleado_puesto_id_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_imagenes_acta_entrega_producto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `acta_id` INTEGER NOT NULL,

    INDEX `c_imagenes_acta_entrega_producto_acta_id_fkey`(`acta_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_imagenes_apertura_cierre_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `apetura_cierre_id` INTEGER NOT NULL,
    `original_name` LONGTEXT NOT NULL,

    INDEX `c_imagenes_apertura_cierre_puesto_apetura_cierre_id_fkey`(`apetura_cierre_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_imagenes_control_asistencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `control_id` INTEGER NOT NULL,
    `original_name` LONGTEXT NOT NULL,

    INDEX `c_imagenes_control_asistencia_control_id_fkey`(`control_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_imagenes_vehiculos_corporativos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `vehiculo_id` INTEGER NOT NULL,

    INDEX `c_imagenes_vehiculos_corporativos_vehiculo_id_fkey`(`vehiculo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_incidente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `corpo_id` INTEGER NOT NULL,
    `ejecutivo_cuenta` INTEGER NOT NULL,
    `fecha_incidente` DATE NOT NULL,
    `fecha_reporte` DATE NOT NULL,
    `nombre_responsable` VARCHAR(45) NOT NULL,
    `clasificacion` INTEGER NOT NULL,
    `descripcion` LONGTEXT NOT NULL,
    `involucrados` LONGTEXT NOT NULL,
    `fecha_libro_novedades` LONGTEXT NOT NULL,
    `nombre_responsable_atencion` VARCHAR(45) NOT NULL,
    `solucion` LONGTEXT NULL,
    `fecha_solucion` DATE NULL,
    `fecha_real_solucion` DATE NULL,
    `costo_asociado` LONGTEXT NULL,
    `consecutivo_informe` LONGTEXT NULL,
    `link_informe` LONGTEXT NULL,
    `cliente_id` INTEGER NOT NULL,
    `empresa_id` INTEGER NOT NULL,
    `estado` BOOLEAN NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `created_by` INTEGER NOT NULL,

    INDEX `c_incidente_clasificacion_fkey`(`clasificacion`),
    INDEX `c_incidente_cliente_id_fkey`(`cliente_id`),
    INDEX `c_incidente_corpo_id_fkey`(`corpo_id`),
    INDEX `c_incidente_ejecutivo_cuenta_fkey`(`ejecutivo_cuenta`),
    INDEX `c_incidente_empresa_id_fkey`(`empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_maestro_quejas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `contrato_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `plaza_id` INTEGER NOT NULL,
    `sociedad` VARCHAR(191) NOT NULL,
    `nombre_realiza_queja` VARCHAR(191) NOT NULL,
    `cliente` VARCHAR(191) NOT NULL,
    `empresa_presenta_queja` VARCHAR(191) NOT NULL,
    `persona_presenta_queja` VARCHAR(191) NOT NULL,
    `medio_recepcion_queja` VARCHAR(191) NOT NULL,
    `tipo_queja` VARCHAR(191) NOT NULL,
    `ubicacion` VARCHAR(191) NOT NULL,
    `nivel_queja` VARCHAR(191) NOT NULL,
    `fecha_queja` VARCHAR(191) NOT NULL,
    `motivo_queja` VARCHAR(191) NOT NULL,
    `descripcion_queja` LONGTEXT NOT NULL,
    `fecha_inicio` VARCHAR(191) NOT NULL,
    `fecha_revision` VARCHAR(191) NOT NULL,
    `resolucion_queja` LONGTEXT NOT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `accion_correctiva_preventiva` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_mantenimiento_vehiculos_corporativos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehiculo_id` INTEGER NOT NULL,
    `fecha` DATETIME(0) NOT NULL,
    `tipo` VARCHAR(25) NOT NULL,
    `mantenimiento` LONGTEXT NOT NULL,
    `diagnostico` LONGTEXT NOT NULL,
    `kilometraje_siguiente_revision` INTEGER NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `imagen_antes` LONGTEXT NOT NULL,
    `imagen_despues` LONGTEXT NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `firma_mecanico` LONGTEXT NOT NULL,
    `nombre_mecanico` LONGTEXT NOT NULL,

    INDEX `c_mantenimiento_vehiculos_corporativos_vehiculo_id_fkey`(`vehiculo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_movimientos_articulo_mantenimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `articulo_plan_id` INTEGER NULL,
    `articulo_asignado_id` INTEGER NULL,
    `nombre_persona_recibe` VARCHAR(255) NOT NULL,
    `nombre_persona_entrega` VARCHAR(255) NOT NULL,
    `departamento` VARCHAR(255) NOT NULL,
    `telefono` VARCHAR(20) NOT NULL,
    `entrega` VARCHAR(255) NOT NULL,
    `recibe` VARCHAR(255) NOT NULL,
    `fecha` DATE NOT NULL,
    `hora` TIME(0) NOT NULL,
    `firma_entrega` LONGTEXT NOT NULL,
    `firma_recibe` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,

    INDEX `c_movimientos_articulo_mantenimiento_articulo_asignado_id_fkey`(`articulo_asignado_id`),
    INDEX `c_movimientos_articulo_mantenimiento_articulo_plan_id_fkey`(`articulo_plan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_notas_voz` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NULL,
    `titulo` LONGTEXT NOT NULL,
    `descripcion` LONGTEXT NOT NULL,
    `path` LONGTEXT NOT NULL,
    `transcripcion` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL,

    INDEX `c_notas_voz_cliente_id_fkey`(`cliente_id`),
    INDEX `c_notas_voz_corpo_id_fkey`(`corpo_id`),
    INDEX `c_notas_voz_empresa_id_fkey`(`empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` LONGTEXT NOT NULL,
    `description` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_plaza_notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plazaId` INTEGER NOT NULL,
    `notificationId` INTEGER NOT NULL,
    `watched` BOOLEAN NOT NULL DEFAULT false,

    INDEX `c_plaza_notification_notificationId_fkey`(`notificationId`),
    INDEX `c_plaza_notification_plazaId_fkey`(`plazaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_producto_no_conforme` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `fecha_identificacion` DATE NOT NULL,
    `responsable_cuenta` VARCHAR(50) NOT NULL,
    `tipo_servicio_no_conforme` VARCHAR(50) NOT NULL,
    `persona_identifico_pnc` VARCHAR(255) NOT NULL,
    `descripcion` LONGTEXT NOT NULL,
    `persona_origino_pnc` VARCHAR(255) NOT NULL,
    `accion_implementada` LONGTEXT NOT NULL,
    `fecha_solucion` DATE NOT NULL,
    `responsable_aprobar` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NOT NULL,
    `firma_persona_identifico_pnc` LONGTEXT NOT NULL,
    `firma_persona_origino_pnc` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,

    INDEX `c_producto_no_conforme_cliente_id_fkey`(`cliente_id`),
    INDEX `c_producto_no_conforme_corpo_id_fkey`(`corpo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_puesto_notas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(255) NOT NULL,
    `description` LONGTEXT NOT NULL,
    `categoria_id` INTEGER NULL,
    `puesto_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,
    `relevancia` VARCHAR(16) NULL,

    INDEX `puesto_id_notas_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_puesto_notas_bitacora_cambios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nota_id` INTEGER NOT NULL,
    `empleado_id` INTEGER NOT NULL,
    `titulo` VARCHAR(255) NOT NULL,
    `description` LONGTEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `categoria` VARCHAR(191) NOT NULL DEFAULT '-',
    `relevancia` VARCHAR(16) NULL,

    INDEX `c_puesto_notas_bitacora_cambios_empleado_id_fkey`(`empleado_id`),
    INDEX `c_puesto_notas_bitacora_cambios_nota_id_fkey`(`nota_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_registro_induccion_general` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `division` VARCHAR(50) NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `temas_a_tratar` LONGTEXT NOT NULL,
    `colaboradores` LONGTEXT NOT NULL,
    `capacitadores` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NOT NULL,

    INDEX `c_registro_induccion_general_cliente_id_fkey`(`cliente_id`),
    INDEX `c_registro_induccion_general_corpo_id_fkey`(`corpo_id`),
    INDEX `c_registro_induccion_general_empresa_id_fkey`(`empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_registro_induccion_recorrido` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `contrato_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `plaza_id` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `renglon_edificio` VARCHAR(191) NOT NULL,
    `supervisor_cliente` VARCHAR(191) NULL,
    `supervisor_corporacion` VARCHAR(191) NOT NULL,
    `temas_desarrollados` LONGTEXT NOT NULL,
    `aspectos_especificos` LONGTEXT NOT NULL,
    `participantes` LONGTEXT NOT NULL,
    `firma_supervisor` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NOT NULL,
    `division` VARCHAR(191) NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `empleado_id` INTEGER NOT NULL,
    `firma_empleado` LONGTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_solicitud_permiso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` VARCHAR(191) NOT NULL,
    `cliente_id` VARCHAR(191) NOT NULL,
    `contrato_id` VARCHAR(191) NOT NULL,
    `corpo_id` VARCHAR(191) NOT NULL,
    `puesto_id` VARCHAR(191) NOT NULL,
    `plaza_id` VARCHAR(191) NOT NULL,
    `persona_solicita` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `contrato` VARCHAR(191) NOT NULL,
    `horario` VARCHAR(191) NOT NULL,
    `fecha_solicitud` DATETIME(3) NOT NULL,
    `motivo_permiso` LONGTEXT NOT NULL,
    `permiso_sustituido_por` VARCHAR(191) NOT NULL,
    `codigo_sustituto` VARCHAR(191) NOT NULL,
    `firma_gerente` LONGTEXT NOT NULL,
    `firma_encargado_monitoreo` LONGTEXT NOT NULL,
    `permiso_coordinado_por` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NOT NULL,
    `firma_responsables` LONGTEXT NOT NULL,
    `division` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_usos_vehiculos_corporativos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bitacora_id` INTEGER NULL,
    `vehiculo_id` INTEGER NOT NULL,
    `nombre_conductor` VARCHAR(55) NOT NULL,
    `fecha` DATETIME(0) NOT NULL,
    `hora_inicio` TIME(0) NOT NULL,
    `hora_fin` TIME(0) NOT NULL,
    `combustible_inicio` INTEGER NOT NULL,
    `combustible_fin` INTEGER NOT NULL,
    `km_inicio` INTEGER NOT NULL,
    `km_fin` INTEGER NOT NULL,
    `motivo` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,

    INDEX `c_usos_vehiculos_corporativos_vehiculo_id_fkey`(`vehiculo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_vehiculos_corporativos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `sucursal_id` INTEGER NOT NULL,
    `placa` VARCHAR(52) NOT NULL,
    `tipo` VARCHAR(52) NOT NULL,
    `kilometraje` INTEGER NOT NULL,
    `prox_cambio_aceite` INTEGER NOT NULL,
    `modelo` VARCHAR(52) NOT NULL,
    `anno` INTEGER NOT NULL,
    `descripcion` LONGTEXT NOT NULL,
    `titulo_propiedad` BOOLEAN NOT NULL DEFAULT true,
    `rtv` BOOLEAN NOT NULL DEFAULT true,
    `marchamo` BOOLEAN NOT NULL DEFAULT true,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `estado` VARCHAR(25) NOT NULL,
    `empresa_id` INTEGER NOT NULL,

    INDEX `c_vehiculos_corporativos_cliente_id_fkey`(`cliente_id`),
    INDEX `c_vehiculos_corporativos_sucursal_id_fkey`(`sucursal_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_actividad_corpo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `contrato_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NULL,
    `plaza_id` INTEGER NULL,
    `nombre_actividad` VARCHAR(255) NOT NULL,
    `fecha_inicio` DATE NOT NULL,
    `frecuencia` LONGTEXT NOT NULL,
    `es_revision_equipo` BOOLEAN NOT NULL,
    `descripcion_actividad` LONGTEXT NOT NULL,
    `reglas` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,

    INDEX `e_actividad_corpo_cliente_id_fkey`(`cliente_id`),
    INDEX `e_actividad_corpo_contrato_id_fkey`(`contrato_id`),
    INDEX `e_actividad_corpo_corpo_id_fkey`(`corpo_id`),
    INDEX `e_actividad_corpo_empresa_id_fkey`(`empresa_id`),
    INDEX `e_actividad_corpo_plaza_id_fkey`(`plaza_id`),
    INDEX `e_actividad_corpo_puesto_id_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_actividad_corpo_plaza` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actividadCorpo_id` INTEGER NOT NULL,
    `plaza_id` INTEGER NOT NULL,
    `bitacora` LONGTEXT NOT NULL,
    `file_name` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `marcada` BOOLEAN NOT NULL DEFAULT false,

    INDEX `e_actividad_corpo_plaza_actividadCorpo_id_fkey`(`actividadCorpo_id`),
    INDEX `e_actividad_corpo_plaza_plaza_id_fkey`(`plaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_actividad_corpo_revision_equipo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `articulo_id` INTEGER NOT NULL,
    `es_correcto` BOOLEAN NOT NULL,
    `motivo_incorrecto` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `marcada` BOOLEAN NOT NULL DEFAULT false,
    `file_name` LONGTEXT NULL,
    `actividadCorpoPlaza_id` INTEGER NOT NULL,

    INDEX `e_actividad_corpo_revision_equipo_actividad_corpo_plaza_fkey`(`actividadCorpoPlaza_id`),
    INDEX `e_actividad_corpo_revision_equipo_articulo_id_fkey`(`articulo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_actividad_puesto_plaza` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actividadCorpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `plaza_id` INTEGER NULL,

    INDEX `e_actividad_puesto_plaza_actividadCorpo_id_fkey`(`actividadCorpo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_activo_visitante` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitante_id` INTEGER NOT NULL,
    `tipo_id` INTEGER NOT NULL,
    `detalles` LONGTEXT NOT NULL,
    `numero_serie` VARCHAR(50) NOT NULL,
    `numero_activo` VARCHAR(50) NULL,

    INDEX `FK_BB503B25992BE739`(`visitante_id`),
    INDEX `FK_BB503B25993BE739`(`tipo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_archivos_manual_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `type` VARCHAR(25) NOT NULL,
    `extension` VARCHAR(25) NOT NULL,
    `manual_puesto_id` INTEGER NOT NULL,
    `original_name` LONGTEXT NOT NULL,

    INDEX `e_archivos_manual_puesto_manual_puesto_id_fkey`(`manual_puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_archivos_producto_no_conforme` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `type` VARCHAR(25) NOT NULL,
    `extension` VARCHAR(25) NOT NULL,
    `pnc_id` INTEGER NOT NULL,
    `original_name` LONGTEXT NOT NULL,

    INDEX `e_archivos_producto_no_conforme_pnc_id_fkey`(`pnc_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_capacitacion_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `capacitacion_id` INTEGER NOT NULL,
    `empleado_id` INTEGER NOT NULL,

    INDEX `e_capacitacion_empleado_capacitacion_id_fkey`(`capacitacion_id`),
    INDEX `e_capacitacion_empleado_empleado_id_fkey`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_capacitacion_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `capacitacion_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,

    INDEX `e_capacitacion_puesto_capacitacion_id_fkey`(`capacitacion_id`),
    INDEX `e_capacitacion_puesto_puesto_id_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_control_documento_entregado_cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `fecha` DATE NOT NULL,
    `nombre_oficial_entrega` VARCHAR(255) NOT NULL,
    `nombre_oficial_recibe` VARCHAR(255) NOT NULL,
    `tipo_documento` VARCHAR(255) NOT NULL,
    `descripcion` LONGTEXT NOT NULL,
    `firma_representante_cliente` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,

    INDEX `e_control_documento_entregado_cliente_cliente_id_fkey`(`cliente_id`),
    INDEX `e_control_documento_entregado_cliente_corpo_id_fkey`(`corpo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_empleado_visualizacion_archivos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `type` VARCHAR(25) NOT NULL,
    `extension` VARCHAR(25) NOT NULL,
    `visualizacion_id` INTEGER NOT NULL,
    `original_name` LONGTEXT NOT NULL,

    INDEX `e_archivos_empleado_visualizacion_id_fkey`(`visualizacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_empleado_visualizacion_manual_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `manual_puesto_id` INTEGER NOT NULL,
    `nombre_empleado` LONGTEXT NOT NULL,
    `firma_empleado` LONGTEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `quiz_answear` LONGTEXT NULL,
    `updated_at` DATETIME(0) NOT NULL,
    `approved` BOOLEAN NULL,

    INDEX `e_empleado_visualizacion_manual_puesto_empleado_id_fkey`(`empleado_id`),
    INDEX `e_empleado_visualizacion_manual_puesto_manual_puesto_id_fkey`(`manual_puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_llave` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `lugar_abre` VARCHAR(255) NOT NULL,
    `cantidad_copias` INTEGER NOT NULL,
    `observaciones` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL,

    INDEX `e_llave_cliente_id_fkey`(`cliente_id`),
    INDEX `e_llave_corpo_id_fkey`(`corpo_id`),
    INDEX `e_llave_puesto_id_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_llave_en_llavero` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `llave_id` INTEGER NOT NULL,
    `llavero_id` INTEGER NOT NULL,

    INDEX `e_llave_en_llavero_llave_id_fkey`(`llave_id`),
    INDEX `e_llave_en_llavero_llavero_id_fkey`(`llavero_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_llavero` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `observaciones` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `nombre_llavero` VARCHAR(50) NOT NULL,

    INDEX `e_llavero_cliente_id_fkey`(`cliente_id`),
    INDEX `e_llavero_corpo_id_fkey`(`corpo_id`),
    INDEX `e_llavero_puesto_id_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_manual_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` LONGTEXT NOT NULL,
    `description` LONGTEXT NOT NULL,
    `firma` LONGTEXT NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `created_by` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `quiz` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_movimiento_llave` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `llave_id` INTEGER NOT NULL,
    `nombre_persona_recibe` VARCHAR(255) NOT NULL,
    `nombre_persona_entrega` VARCHAR(255) NOT NULL,
    `departamento` VARCHAR(255) NOT NULL,
    `telefono` VARCHAR(20) NOT NULL,
    `fecha` DATE NOT NULL,
    `hora` TIME(0) NOT NULL,
    `firma_entrega` LONGTEXT NOT NULL,
    `firma_recibe` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,

    INDEX `e_movimiento_llave_llave_id_fkey`(`llave_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_movimiento_llavero` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `llavero_id` INTEGER NOT NULL,
    `nombre_persona_recibe` VARCHAR(255) NOT NULL,
    `nombre_persona_entrega` VARCHAR(255) NOT NULL,
    `departamento` VARCHAR(255) NOT NULL,
    `telefono` VARCHAR(20) NOT NULL,
    `fecha` DATE NOT NULL,
    `hora` TIME(0) NOT NULL,
    `firma_entrega` LONGTEXT NOT NULL,
    `firma_recibe` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,

    INDEX `e_movimiento_llavero_llavero_id_fkey`(`llavero_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_mutuos_acuerdos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `ejecutivo_cuenta` INTEGER NOT NULL,
    `fecha` DATE NOT NULL,
    `turno` VARCHAR(50) NOT NULL,
    `informacion_oficial_interesado` LONGTEXT NOT NULL,
    `informacion_oficial_colaborador` LONGTEXT NOT NULL,
    `motivo` LONGTEXT NOT NULL,
    `firma_ejecutivo_cuenta` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `created_by` INTEGER NOT NULL,

    INDEX `e_mutuos_acuerdos_cliente_id_fkey`(`cliente_id`),
    INDEX `e_mutuos_acuerdos_corpo_id_fkey`(`corpo_id`),
    INDEX `e_mutuos_acuerdos_ejecutivo_cuenta_fkey`(`ejecutivo_cuenta`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_puestos_manual_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `manual_puesto_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,

    INDEX `e_puestos_manual_puesto_manual_puesto_id_fkey`(`manual_puesto_id`),
    INDEX `e_puestos_manual_puesto_puesto_id_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_registro_capacitaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `titulo` LONGTEXT NOT NULL,
    `descripcion` LONGTEXT NOT NULL,
    `resultado` VARCHAR(15) NULL,
    `observaciones` LONGTEXT NOT NULL,
    `nombre_responsable` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `cedula_responsable` VARCHAR(25) NOT NULL,
    `responsable_id` INTEGER NOT NULL,
    `fecha` DATE NOT NULL,
    `file` LONGTEXT NULL,
    `tipo` VARCHAR(15) NOT NULL,

    INDEX `e_registro_capacitaciones_cliente_id_fkey`(`cliente_id`),
    INDEX `e_registro_capacitaciones_corpo_id_fkey`(`corpo_id`),
    INDEX `e_registro_capacitaciones_empresa_id_fkey`(`empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_registro_entrega_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `oficial_entrega` VARCHAR(255) NOT NULL,
    `fecha_entrada_entrega` DATE NOT NULL,
    `fecha_salida_entrega` DATE NOT NULL,
    `hora_entrada_entrega` TIME(0) NOT NULL,
    `hora_salida_entrega` TIME(0) NOT NULL,
    `turno_entrega` VARCHAR(55) NOT NULL,
    `oficial_recibe` VARCHAR(255) NOT NULL,
    `fecha_entrada_recibe` DATE NOT NULL,
    `fecha_salida_recibe` DATE NOT NULL,
    `hora_entrada_recibe` TIME(0) NOT NULL,
    `hora_salida_recibe` TIME(0) NOT NULL,
    `turno_recibe` VARCHAR(55) NOT NULL,
    `articulos_puesto` LONGTEXT NOT NULL,
    `observaciones` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `created_by` INTEGER NOT NULL,

    INDEX `e_registro_entrega_puesto_cliente_id_fkey`(`cliente_id`),
    INDEX `e_registro_entrega_puesto_corpo_id_fkey`(`corpo_id`),
    INDEX `e_registro_entrega_puesto_puesto_id_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_registro_personas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `nombre` VARCHAR(75) NOT NULL,
    `cedula` VARCHAR(30) NOT NULL,
    `hora_entrada` DATETIME(0) NOT NULL,
    `hora_salida` DATETIME(0) NULL,
    `razon_visita` VARCHAR(75) NOT NULL,
    `responsable_id` INTEGER NOT NULL,
    `es_funcionario` BOOLEAN NOT NULL,
    `observaciones` VARCHAR(255) NULL,
    `tipo_accion` VARCHAR(15) NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,
    `foto_cedula` LONGTEXT NULL,
    `pers_autoriza_salida` VARCHAR(255) NULL,

    INDEX `FK_BB503B25992BE730`(`responsable_id`),
    INDEX `FK_BB603B25953BE730`(`cliente_id`),
    INDEX `FK_BB703B25954BE730`(`corpo_id`),
    INDEX `FK_BB803B25955BE730`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_registro_vehiculos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `placa` VARCHAR(30) NOT NULL,
    `nombre` VARCHAR(75) NOT NULL,
    `cedula` VARCHAR(30) NOT NULL,
    `hora_entrada` DATETIME(0) NOT NULL,
    `hora_salida` DATETIME(0) NULL,
    `razon_visita` LONGTEXT NOT NULL,
    `responsable_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,
    `file_name` LONGTEXT NULL,

    INDEX `FK_BB503B25952BE730`(`responsable_id`),
    INDEX `FK_BB503B25953BE730`(`cliente_id`),
    INDEX `FK_BB503B25954BE730`(`corpo_id`),
    INDEX `FK_BB503B25955BE730`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_tipo_documento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_clasificacion_incidente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `UNIQ_92DE8E473A988126`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_novedades_categoria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_activo_visitas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `UNIQ_92DE8E473A989126`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `n_tipo_mantenimiento_articulo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `articulo_id` INTEGER NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,

    INDEX `n_tipo_mantenimiento_articulo_articulo_id_fkey`(`articulo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,
    `empleadoId` INTEGER NOT NULL,
    `sessionId` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `refresh_token_token_key`(`token`),
    INDEX `refresh_token_empleadoId_idx`(`empleadoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B30426475F636ED` FOREIGN KEY (`empleadoAusente_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B3042647963DFC5` FOREIGN KEY (`marcaDia_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B304264799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B3042647F5F4055` FOREIGN KEY (`motivoRechazo_id`) REFERENCES `n_motivo_rechazo_extra`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B30426481B56B3` FOREIGN KEY (`coordinadoPor_id`) REFERENCES `n_coordinado_por`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B3042648D7C55D2` FOREIGN KEY (`sindicato_id`) REFERENCES `n_sindicato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B304264952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B304264B0B41592` FOREIGN KEY (`tipoContratacion_id`) REFERENCES `n_tipo_contratacion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B304264CAA77C0D` FOREIGN KEY (`planillaExtraEmpleado_id`) REFERENCES `pg_planilla_extra_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B304264D2624C39` FOREIGN KEY (`periodoPago_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B304264E4517BDD` FOREIGN KEY (`coordinador_id`) REFERENCES `n_coordinador`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B304264ED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B304264EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_3B304264F9E584F8` FOREIGN KEY (`motivo_id`) REFERENCES `n_motivo_extra`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal_linea` ADD CONSTRAINT `FK_54EA19084558C79` FOREIGN KEY (`accionPersonal_id`) REFERENCES `c_accion_personal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal_linea` ADD CONSTRAINT `FK_54EA1908620C225E` FOREIGN KEY (`reemplazo_id`) REFERENCES `c_empleado`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_traslado` ADD CONSTRAINT `FK_BEFF7AEC1B482BBB` FOREIGN KEY (`plazaInicial_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_articulo_uniforme_empleado` ADD CONSTRAINT `FK_F0617B2F4591C704` FOREIGN KEY (`articuloUniforme_id`) REFERENCES `n_articulo_uniforme`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_articulo_uniforme_empleado` ADD CONSTRAINT `FK_F0617B2F952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_planilla_empleado` ADD CONSTRAINT `FK_F450C66C952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_planilla_empleado` ADD CONSTRAINT `FK_F450C66CF747F090` FOREIGN KEY (`planilla_id`) REFERENCES `s_planilla`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE175A33D1` FOREIGN KEY (`incapacidad_ins_id`) REFERENCES `c_incapacidad_ins`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE3A0F5A23` FOREIGN KEY (`licencia_id`) REFERENCES `c_licencia`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE3C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE3F0F0EAB` FOREIGN KEY (`cambio_horario_id`) REFERENCES `c_cambio_horario`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE43A913D8` FOREIGN KEY (`accionGeneraSeparacion_id`) REFERENCES `c_accion_personal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE45BFCF7F` FOREIGN KEY (`tipoAccion_id`) REFERENCES `c_tipo_accion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE4959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE4A1627FE` FOREIGN KEY (`permiso_sin_goce_id`) REFERENCES `c_permiso_sin_goce`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE5035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE5D5F8F8E` FOREIGN KEY (`suspension_id`) REFERENCES `c_suspension`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE60C93433` FOREIGN KEY (`ausencia_id`) REFERENCES `c_ausencia`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE620C225E` FOREIGN KEY (`reemplazo_id`) REFERENCES `c_empleado`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE64E87FA9` FOREIGN KEY (`adenda_id`) REFERENCES `c_adendas`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE68DBB923` FOREIGN KEY (`contratacion_id`) REFERENCES `c_contratacion`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE6A6AE222` FOREIGN KEY (`libre_cubre_vacasiones_id`) REFERENCES `c_libre_cubre_vacasiones`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE70AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE81B56B3` FOREIGN KEY (`coordinadoPor_id`) REFERENCES `n_coordinado_por`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE89D8089F` FOREIGN KEY (`preaviso_id`) REFERENCES `c_preaviso`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE8BF5BDE5` FOREIGN KEY (`baja_id`) REFERENCES `c_baja`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEE952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEA0E4F3B3` FOREIGN KEY (`separacion_temp_id`) REFERENCES `c_separacion_temp`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEA61F9752` FOREIGN KEY (`ajuste_salario_id`) REFERENCES `c_ajuste_salario`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEA74E1638` FOREIGN KEY (`traslado_id`) REFERENCES `c_traslado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEAD90890` FOREIGN KEY (`vacacion_pago_id`) REFERENCES `c_vacacion_pago`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEB0B41592` FOREIGN KEY (`tipoContratacion_id`) REFERENCES `n_tipo_contratacion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEC4298A13` FOREIGN KEY (`vacacionMes_id`) REFERENCES `v_vacacion_mes`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEECE18A6FD` FOREIGN KEY (`cambio_periodo_pago_id`) REFERENCES `c_cambio_periodo_pago`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEED2624C39` FOREIGN KEY (`periodoPago_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEDE734E51` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEDF363018` FOREIGN KEY (`salida_anticipada_id`) REFERENCES `c_salida_anticipada`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEDF88A977` FOREIGN KEY (`llegada_tardia_id`) REFERENCES `c_llegada_tardia`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEE4517BDD` FOREIGN KEY (`coordinador_id`) REFERENCES `n_coordinador`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEE5C49C4` FOREIGN KEY (`incapacidad_ccss_id`) REFERENCES `c_incapacidad_ccss`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEE78BA714` FOREIGN KEY (`traslado_temp_id`) REFERENCES `c_traslado_temp`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEE9FE9372` FOREIGN KEY (`permiso_con_goce_id`) REFERENCES `c_permiso_con_goce`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEEEC5118E` FOREIGN KEY (`vacacion_disfrute_id`) REFERENCES `c_vacacion_disfrute`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_accion_personal` ADD CONSTRAINT `FK_97D9ECEEEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E52F4E077F` FOREIGN KEY (`motivoMarcarHorarioPlaza_id`) REFERENCES `n_motivo_marcar_horario_plaza`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E537A7CDB4` FOREIGN KEY (`marcaComoReemplazo_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E53C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E53CE4E731` FOREIGN KEY (`empleadoFijo_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E54558C79` FOREIGN KEY (`accionPersonal_id`) REFERENCES `c_accion_personal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E54959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E55035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E5521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E5547FB693` FOREIGN KEY (`marcaCdgHacia_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E56B95DB` FOREIGN KEY (`empleadoCDG_id`) REFERENCES `c_empleado`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E570AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E58602BB` FOREIGN KEY (`motivoExtra_id`) REFERENCES `n_motivo_extra`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E58E25225` FOREIGN KEY (`marcaComoReemplazo2_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E59D7193A2` FOREIGN KEY (`empleadoReemplaza_id`) REFERENCES `c_empleado`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E5BBF7CA96` FOREIGN KEY (`marcaEnInduccion_id`) REFERENCES `c_marca_dia`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E5DE734E51` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E5E4517BDD` FOREIGN KEY (`coordinador_id`) REFERENCES `n_coordinador`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E5EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E5F9838DA4` FOREIGN KEY (`motivoErrorAsignacion_id`) REFERENCES `n_motivo_error_asignacion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_marca_dia` ADD CONSTRAINT `FK_583C45E5FC9C312A` FOREIGN KEY (`empleadoReemplaza2_id`) REFERENCES `c_empleado`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `a_recibo_pago` ADD CONSTRAINT `FK_23679AA8DE734E51` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `b_consecutivo_empresa_banco` ADD CONSTRAINT `FK_E8669A36521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `b_consecutivo_empresa_banco` ADD CONSTRAINT `FK_E8669A36CC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `b_pago_excluido` ADD CONSTRAINT `FK_E34A23BC952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_adendas` ADD CONSTRAINT `FK_C15A2329952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_adendas` ADD CONSTRAINT `FK_C15A2329A1C0A276` FOREIGN KEY (`apoderado_id`) REFERENCES `n_apoderado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_articulo_uniforme_plaza` ADD CONSTRAINT `FK_9F3A46B04591C704` FOREIGN KEY (`articuloUniforme_id`) REFERENCES `n_articulo_uniforme`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_articulo_uniforme_plaza` ADD CONSTRAINT `FK_9F3A46B0EB6587E3` FOREIGN KEY (`combo_id`) REFERENCES `c_combo_uniforme_plaza`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_baja` ADD CONSTRAINT `FK_F87CC83189D8089F` FOREIGN KEY (`preaviso_id`) REFERENCES `c_preaviso`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_baja__n_motivo_no_recontratable` ADD CONSTRAINT `FK_4E7270C72DDF1AAA` FOREIGN KEY (`cbaja_id`) REFERENCES `c_baja`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_baja__n_motivo_no_recontratable` ADD CONSTRAINT `FK_4E7270C73F43B690` FOREIGN KEY (`nmotivonorecontratable_id`) REFERENCES `n_motivo_no_recontratable`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_bonificacion_turno` ADD CONSTRAINT `FK_1F8A4D4970AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_bonificacion_turno` ADD CONSTRAINT `FK_1F8A4D49ED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_bonificaciones` ADD CONSTRAINT `FK_3DBD73D9952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_salida_anticipada` ADD CONSTRAINT `c_salida_anticipada_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `a_recovery_password_token` ADD CONSTRAINT `FK_E35A23BC952BE730` FOREIGN KEY (`empleadoId`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `c_agenda_minuta` ADD CONSTRAINT `c_agenda_minuta_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_agenda_minuta` ADD CONSTRAINT `c_agenda_minuta_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_agenda_minuta` ADD CONSTRAINT `c_agenda_minuta_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_anexos_quejas` ADD CONSTRAINT `c_anexos_quejas_queja_id_fkey` FOREIGN KEY (`queja_id`) REFERENCES `c_maestro_quejas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_apertura_cierre_puesto` ADD CONSTRAINT `c_apertura_cierre_puesto_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_apertura_cierre_puesto` ADD CONSTRAINT `c_apertura_cierre_puesto_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_apertura_cierre_puesto` ADD CONSTRAINT `c_apertura_cierre_puesto_division_id_fkey` FOREIGN KEY (`division_id`) REFERENCES `n_division`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_apertura_cierre_puesto` ADD CONSTRAINT `c_apertura_cierre_puesto_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_archivos_adjuntos_articulo_mantenimiento` ADD CONSTRAINT `c_archivos_adjuntos_articulo_mantenimiento_activo_mantenimi_fkey` FOREIGN KEY (`activo_mantenimiento_id`) REFERENCES `c_articulo_mantenimiento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_archivos_aporte_incidente` ADD CONSTRAINT `c_archivos_aporte_incidente_contribucion_id_fkey` FOREIGN KEY (`contribucion_id`) REFERENCES `c_contribucion_incidente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_archivos_incidente` ADD CONSTRAINT `c_archivos_incidente_incidente_id_fkey` FOREIGN KEY (`incidente_id`) REFERENCES `c_incidente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_articulo_mantenimiento` ADD CONSTRAINT `c_articulo_mantenimiento_articulo_asignado_id_fkey` FOREIGN KEY (`articulo_asignado_id`) REFERENCES `e_estructura_articulo_corpo_puesto_entrega`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_articulo_mantenimiento` ADD CONSTRAINT `c_articulo_mantenimiento_articulo_plan_id_fkey` FOREIGN KEY (`articulo_plan_id`) REFERENCES `e_estructura_articulo_corpo_puesto_plan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_boleta_apreciacion_vulnerabilidad` ADD CONSTRAINT `c_boleta_apreciacion_vulnerabilidad_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_boleta_apreciacion_vulnerabilidad` ADD CONSTRAINT `c_boleta_apreciacion_vulnerabilidad_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_boleta_apreciacion_vulnerabilidad` ADD CONSTRAINT `c_boleta_apreciacion_vulnerabilidad_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_checklist_supervision` ADD CONSTRAINT `c_checklist_supervision_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_checklist_supervision` ADD CONSTRAINT `c_checklist_supervision_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_checklist_supervision` ADD CONSTRAINT `c_checklist_supervision_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_contribucion_incidente` ADD CONSTRAINT `c_contribucion_incidente_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_contribucion_incidente` ADD CONSTRAINT `c_contribucion_incidente_incidente_id_fkey` FOREIGN KEY (`incidente_id`) REFERENCES `c_incidente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_empleado_almuerzo` ADD CONSTRAINT `c_empleado_almuerzo_empleadoId_fkey` FOREIGN KEY (`empleadoId`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_empleado_notification` ADD CONSTRAINT `c_empleado_notification_empleadoId_fkey` FOREIGN KEY (`empleadoId`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_empleado_notification` ADD CONSTRAINT `c_empleado_notification_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `c_notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_encuesta_cliente` ADD CONSTRAINT `c_encuesta_cliente_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_encuesta_cliente` ADD CONSTRAINT `c_encuesta_cliente_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_encuesta_cliente` ADD CONSTRAINT `c_encuesta_cliente_division_id_fkey` FOREIGN KEY (`division_id`) REFERENCES `n_division`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_encuesta_cliente` ADD CONSTRAINT `c_encuesta_cliente_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_encuesta_cliente` ADD CONSTRAINT `c_encuesta_cliente_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_encuesta_cliente` ADD CONSTRAINT `c_encuesta_cliente_responsable_id_fkey` FOREIGN KEY (`responsable_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_evaluacion_empleado` ADD CONSTRAINT `c_evaluacion_empleado_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_evaluacion_empleado` ADD CONSTRAINT `c_evaluacion_empleado_plaza_id_fkey` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_evaluacion_empleado` ADD CONSTRAINT `c_evaluacion_empleado_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_imagenes_acta_entrega_producto` ADD CONSTRAINT `c_imagenes_acta_entrega_producto_acta_id_fkey` FOREIGN KEY (`acta_id`) REFERENCES `c_acta_entre_producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_imagenes_apertura_cierre_puesto` ADD CONSTRAINT `c_imagenes_apertura_cierre_puesto_apetura_cierre_id_fkey` FOREIGN KEY (`apetura_cierre_id`) REFERENCES `c_apertura_cierre_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_imagenes_control_asistencia` ADD CONSTRAINT `c_imagenes_control_asistencia_control_id_fkey` FOREIGN KEY (`control_id`) REFERENCES `c_control_asistencia`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_imagenes_vehiculos_corporativos` ADD CONSTRAINT `c_imagenes_vehiculos_corporativos_vehiculo_id_fkey` FOREIGN KEY (`vehiculo_id`) REFERENCES `c_vehiculos_corporativos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_incidente` ADD CONSTRAINT `c_incidente_clasificacion_fkey` FOREIGN KEY (`clasificacion`) REFERENCES `n_clasificacion_incidente`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_incidente` ADD CONSTRAINT `c_incidente_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_incidente` ADD CONSTRAINT `c_incidente_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_incidente` ADD CONSTRAINT `c_incidente_ejecutivo_cuenta_fkey` FOREIGN KEY (`ejecutivo_cuenta`) REFERENCES `n_ejecutivo_cuenta`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_incidente` ADD CONSTRAINT `c_incidente_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_mantenimiento_vehiculos_corporativos` ADD CONSTRAINT `c_mantenimiento_vehiculos_corporativos_vehiculo_id_fkey` FOREIGN KEY (`vehiculo_id`) REFERENCES `c_vehiculos_corporativos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_movimientos_articulo_mantenimiento` ADD CONSTRAINT `c_movimientos_articulo_mantenimiento_articulo_asignado_id_fkey` FOREIGN KEY (`articulo_asignado_id`) REFERENCES `e_estructura_articulo_corpo_puesto_entrega`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_movimientos_articulo_mantenimiento` ADD CONSTRAINT `c_movimientos_articulo_mantenimiento_articulo_plan_id_fkey` FOREIGN KEY (`articulo_plan_id`) REFERENCES `e_estructura_articulo_corpo_puesto_plan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_notas_voz` ADD CONSTRAINT `c_notas_voz_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_notas_voz` ADD CONSTRAINT `c_notas_voz_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_notas_voz` ADD CONSTRAINT `c_notas_voz_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_plaza_notification` ADD CONSTRAINT `c_plaza_notification_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `c_notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_plaza_notification` ADD CONSTRAINT `c_plaza_notification_plazaId_fkey` FOREIGN KEY (`plazaId`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_producto_no_conforme` ADD CONSTRAINT `c_producto_no_conforme_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_producto_no_conforme` ADD CONSTRAINT `c_producto_no_conforme_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_puesto_notas` ADD CONSTRAINT `c_puesto_notas_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_puesto_notas_bitacora_cambios` ADD CONSTRAINT `c_puesto_notas_bitacora_cambios_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_puesto_notas_bitacora_cambios` ADD CONSTRAINT `c_puesto_notas_bitacora_cambios_nota_id_fkey` FOREIGN KEY (`nota_id`) REFERENCES `c_puesto_notas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_registro_induccion_general` ADD CONSTRAINT `c_registro_induccion_general_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_registro_induccion_general` ADD CONSTRAINT `c_registro_induccion_general_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_registro_induccion_general` ADD CONSTRAINT `c_registro_induccion_general_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_usos_vehiculos_corporativos` ADD CONSTRAINT `c_usos_vehiculos_corporativos_vehiculo_id_fkey` FOREIGN KEY (`vehiculo_id`) REFERENCES `c_vehiculos_corporativos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_vehiculos_corporativos` ADD CONSTRAINT `c_vehiculos_corporativos_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_vehiculos_corporativos` ADD CONSTRAINT `c_vehiculos_corporativos_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo` ADD CONSTRAINT `e_actividad_corpo_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo` ADD CONSTRAINT `e_actividad_corpo_contrato_id_fkey` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo` ADD CONSTRAINT `e_actividad_corpo_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo` ADD CONSTRAINT `e_actividad_corpo_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo` ADD CONSTRAINT `e_actividad_corpo_plaza_id_fkey` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo` ADD CONSTRAINT `e_actividad_corpo_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo_plaza` ADD CONSTRAINT `e_actividad_corpo_plaza_actividadCorpo_id_fkey` FOREIGN KEY (`actividadCorpo_id`) REFERENCES `e_actividad_corpo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo_plaza` ADD CONSTRAINT `e_actividad_corpo_plaza_plaza_id_fkey` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo_revision_equipo` ADD CONSTRAINT `e_actividad_corpo_revision_equipo_actividadCorpoPlaza_id_fkey` FOREIGN KEY (`actividadCorpoPlaza_id`) REFERENCES `e_actividad_corpo_plaza`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_corpo_revision_equipo` ADD CONSTRAINT `e_actividad_corpo_revision_equipo_articulo_id_fkey` FOREIGN KEY (`articulo_id`) REFERENCES `n_articulo_corpo_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividad_puesto_plaza` ADD CONSTRAINT `e_actividad_puesto_plaza_actividadCorpo_id_fkey` FOREIGN KEY (`actividadCorpo_id`) REFERENCES `e_actividad_corpo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_activo_visitante` ADD CONSTRAINT `FK_BB503B25992BE739` FOREIGN KEY (`visitante_id`) REFERENCES `e_registro_personas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_activo_visitante` ADD CONSTRAINT `FK_BB503B25993BE739` FOREIGN KEY (`tipo_id`) REFERENCES `n_tipo_activo_visitas`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_archivos_manual_puesto` ADD CONSTRAINT `e_archivos_manual_puesto_manual_puesto_id_fkey` FOREIGN KEY (`manual_puesto_id`) REFERENCES `e_manual_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_archivos_producto_no_conforme` ADD CONSTRAINT `e_archivos_producto_no_conforme_pnc_id_fkey` FOREIGN KEY (`pnc_id`) REFERENCES `c_producto_no_conforme`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_capacitacion_empleado` ADD CONSTRAINT `e_capacitacion_empleado_capacitacion_id_fkey` FOREIGN KEY (`capacitacion_id`) REFERENCES `e_registro_capacitaciones`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_capacitacion_empleado` ADD CONSTRAINT `e_capacitacion_empleado_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_capacitacion_puesto` ADD CONSTRAINT `e_capacitacion_puesto_capacitacion_id_fkey` FOREIGN KEY (`capacitacion_id`) REFERENCES `e_registro_capacitaciones`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_capacitacion_puesto` ADD CONSTRAINT `e_capacitacion_puesto_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_control_documento_entregado_cliente` ADD CONSTRAINT `e_control_documento_entregado_cliente_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_control_documento_entregado_cliente` ADD CONSTRAINT `e_control_documento_entregado_cliente_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_empleado_visualizacion_archivos` ADD CONSTRAINT `e_empleado_visualizacion_archivos_visualizacion_id_fkey` FOREIGN KEY (`visualizacion_id`) REFERENCES `e_empleado_visualizacion_manual_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_empleado_visualizacion_manual_puesto` ADD CONSTRAINT `e_empleado_visualizacion_manual_puesto_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_empleado_visualizacion_manual_puesto` ADD CONSTRAINT `e_empleado_visualizacion_manual_puesto_manual_puesto_id_fkey` FOREIGN KEY (`manual_puesto_id`) REFERENCES `e_manual_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_llave` ADD CONSTRAINT `e_llave_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_llave` ADD CONSTRAINT `e_llave_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_llave` ADD CONSTRAINT `e_llave_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_llave_en_llavero` ADD CONSTRAINT `e_llave_en_llavero_llave_id_fkey` FOREIGN KEY (`llave_id`) REFERENCES `e_llave`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_llave_en_llavero` ADD CONSTRAINT `e_llave_en_llavero_llavero_id_fkey` FOREIGN KEY (`llavero_id`) REFERENCES `e_llavero`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_llavero` ADD CONSTRAINT `e_llavero_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_llavero` ADD CONSTRAINT `e_llavero_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_llavero` ADD CONSTRAINT `e_llavero_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_movimiento_llave` ADD CONSTRAINT `e_movimiento_llave_llave_id_fkey` FOREIGN KEY (`llave_id`) REFERENCES `e_llave`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_movimiento_llavero` ADD CONSTRAINT `e_movimiento_llavero_llavero_id_fkey` FOREIGN KEY (`llavero_id`) REFERENCES `e_llavero`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_mutuos_acuerdos` ADD CONSTRAINT `e_mutuos_acuerdos_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_mutuos_acuerdos` ADD CONSTRAINT `e_mutuos_acuerdos_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_mutuos_acuerdos` ADD CONSTRAINT `e_mutuos_acuerdos_ejecutivo_cuenta_fkey` FOREIGN KEY (`ejecutivo_cuenta`) REFERENCES `n_ejecutivo_cuenta`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_puestos_manual_puesto` ADD CONSTRAINT `e_puestos_manual_puesto_manual_puesto_id_fkey` FOREIGN KEY (`manual_puesto_id`) REFERENCES `e_manual_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_puestos_manual_puesto` ADD CONSTRAINT `e_puestos_manual_puesto_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_capacitaciones` ADD CONSTRAINT `e_registro_capacitaciones_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_capacitaciones` ADD CONSTRAINT `e_registro_capacitaciones_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_capacitaciones` ADD CONSTRAINT `e_registro_capacitaciones_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_entrega_puesto` ADD CONSTRAINT `e_registro_entrega_puesto_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_entrega_puesto` ADD CONSTRAINT `e_registro_entrega_puesto_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_entrega_puesto` ADD CONSTRAINT `e_registro_entrega_puesto_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_personas` ADD CONSTRAINT `FK_BB503B25992BE730` FOREIGN KEY (`responsable_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_personas` ADD CONSTRAINT `FK_BB603B25953BE730` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_personas` ADD CONSTRAINT `FK_BB703B25954BE730` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_personas` ADD CONSTRAINT `FK_BB803B25955BE730` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_vehiculos` ADD CONSTRAINT `FK_BB503B25952BE730` FOREIGN KEY (`responsable_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_vehiculos` ADD CONSTRAINT `FK_BB503B25953BE730` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_vehiculos` ADD CONSTRAINT `FK_BB503B25954BE730` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_registro_vehiculos` ADD CONSTRAINT `FK_BB503B25955BE730` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `n_tipo_mantenimiento_articulo` ADD CONSTRAINT `n_tipo_mantenimiento_articulo_articulo_id_fkey` FOREIGN KEY (`articulo_id`) REFERENCES `n_articulo_corpo_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_token` ADD CONSTRAINT `refresh_token_empleadoId_fkey` FOREIGN KEY (`empleadoId`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
