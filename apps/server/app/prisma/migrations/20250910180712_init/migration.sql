-- CreateTable
CREATE TABLE `log_accionpersonal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleadoId` INTEGER NOT NULL,
    `accion` VARCHAR(191) NOT NULL,
    `detalle` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

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
    `titulo` VARCHAR(100) NOT NULL,
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
CREATE TABLE `c_horas_extras` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `fecha` DATE NOT NULL,
    `horas` DECIMAL(5, 2) NOT NULL,
    `descripcion` VARCHAR(254) NULL,

    INDEX `IDX_C_HORAS_EMPLEADO`(`empleado_id`),
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
    `nombre` VARCHAR(50) NOT NULL,
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
CREATE TABLE `consultor_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NULL,
    `fecha` DATETIME(0) NOT NULL,
    `tipo_accion` VARCHAR(32) NULL,
    `solicitud_id` INTEGER NULL,

    INDEX `IDX_45A0E79B1CB9D6E4`(`solicitud_id`),
    INDEX `IDX_45A0E79B952BE730`(`empleado_id`),
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
CREATE TABLE `e_estructura_bitacora_acciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo_nombre` VARCHAR(128) NOT NULL,
    `nombre_tabla` VARCHAR(64) NOT NULL,
    `tipo_accion_base_datos` VARCHAR(10) NOT NULL,
    `fecha_hora` DATETIME(0) NOT NULL,
    `id_foraneo` INTEGER NOT NULL,
    `usuario` VARCHAR(64) NULL,
    `cambios` LONGTEXT NULL,

    INDEX `codigo_nombre_idx`(`codigo_nombre`),
    INDEX `fechaHora_idx`(`fecha_hora`),
    INDEX `nombre_tabla_idx`(`nombre_tabla`),
    INDEX `tipoAccionBaseDatos_idx`(`tipo_accion_base_datos`),
    INDEX `usuario_idx`(`usuario`),
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
CREATE TABLE `log_horario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `horario_id` INTEGER NULL,
    `titulo` VARCHAR(255) NOT NULL,
    `tipo_accion_base_datos` VARCHAR(10) NOT NULL,
    `fecha_hora` DATETIME(0) NOT NULL,
    `id_foraneo` INTEGER NOT NULL,
    `usuario` VARCHAR(64) NULL,
    `cambios` LONGTEXT NULL,
    `unique_request_id` VARCHAR(6) NULL,

    INDEX `IDX_DA956B344959F1BA`(`horario_id`),
    INDEX `fechaHora_idx`(`fecha_hora`),
    INDEX `tipoAccionBaseDatos_idx`(`tipo_accion_base_datos`),
    INDEX `titulo_idx`(`titulo`),
    INDEX `usuario_idx`(`usuario`),
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
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F043360ACC8FA` FOREIGN KEY (`plazaAusente_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F043375F636ED` FOREIGN KEY (`empleadoAusente_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F043381B56B3` FOREIGN KEY (`coordinadoPor_id`) REFERENCES `n_coordinado_por`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F04339D7193A2` FOREIGN KEY (`empleadoReemplaza_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F0433C2F7DD75` FOREIGN KEY (`plazaReemplaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_cambio_guardia` ADD CONSTRAINT `FK_285F0433E4517BDD` FOREIGN KEY (`coordinador_id`) REFERENCES `n_coordinador`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_cambio_horario` ADD CONSTRAINT `FK_E6A5B2C1186B3418` FOREIGN KEY (`horarioInicial_id`) REFERENCES `c_horario`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_cambio_horario` ADD CONSTRAINT `FK_E6A5B2C16E94741B` FOREIGN KEY (`horarioFinal_id`) REFERENCES `c_horario`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_cambio_horario` ADD CONSTRAINT `FK_E6A5B2C1AF8A0D2D` FOREIGN KEY (`categoriaSalarialInicial_id`) REFERENCES `pg_categoria_salarial`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_cambio_horario` ADD CONSTRAINT `FK_E6A5B2C1B8F00EA0` FOREIGN KEY (`categoriaSalarialFinal_id`) REFERENCES `pg_categoria_salarial`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_cambio_periodo_pago` ADD CONSTRAINT `FK_C869871ABB712BEE` FOREIGN KEY (`periodoPagoInicial_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_cambio_periodo_pago` ADD CONSTRAINT `FK_C869871ACD4171BE` FOREIGN KEY (`periodoPagoFinal_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_curso_empleado` ADD CONSTRAINT `FK_EF09AA1287CB4A1F` FOREIGN KEY (`curso_id`) REFERENCES `c_curso`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_curso_empleado` ADD CONSTRAINT `FK_EF09AA12952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_deudas` ADD CONSTRAINT `FK_8AB91D2C6C9408BE` FOREIGN KEY (`tipoDeudas_id`) REFERENCES `n_tipo_deuda`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_deudas` ADD CONSTRAINT `FK_8AB91D2C952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_embargos_judiciales` ADD CONSTRAINT `FK_68326432C5CAD3D1` FOREIGN KEY (`deuda_id`) REFERENCES `c_deudas`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_embargos_pension_alimentaria` ADD CONSTRAINT `FK_B2678676C5CAD3D1` FOREIGN KEY (`deuda_id`) REFERENCES `c_deudas`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999114FAA7C` FOREIGN KEY (`educacionTecnico_id`) REFERENCES `n_educacion_tecnico`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A399919E9AC5F` FOREIGN KEY (`supervisor_id`) REFERENCES `n_ejecutivo_cuenta`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A39991CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A399928F0D5CA` FOREIGN KEY (`escolaridad_id`) REFERENCES `n_escolaridad`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A39992BAEF284` FOREIGN KEY (`estadoCivil_id`) REFERENCES `n_estado_civil`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A399955CD1AE4` FOREIGN KEY (`educacionUniversidad_id`) REFERENCES `n_educacion_universidad`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A39995EEC5E1B` FOREIGN KEY (`educacionPrimaria_id`) REFERENCES `n_educacion_primaria`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A39996EA899DA` FOREIGN KEY (`plazaEmpleado_id`) REFERENCES `c_empleado_plaza`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A399979F98940` FOREIGN KEY (`seguroCaja_id`) REFERENCES `n_seguro_caja`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A39998D7C55D2` FOREIGN KEY (`sindicato_id`) REFERENCES `n_sindicato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999996BD967` FOREIGN KEY (`educacionSecundaria_id`) REFERENCES `n_educacion_secundaria`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999A07740F` FOREIGN KEY (`comboUniforme_id`) REFERENCES `c_combo_uniforme_plaza`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999AB8DC0F8` FOREIGN KEY (`nacionalidad_id`) REFERENCES `n_nacionalidad`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999B0B41592` FOREIGN KEY (`tipoContratacion_id`) REFERENCES `n_tipo_contratacion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999CC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999D2624C39` FOREIGN KEY (`periodoPago_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999ED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado` ADD CONSTRAINT `FK_C84A3999FCBB0AEC` FOREIGN KEY (`tipoPagoCasa_id`) REFERENCES `n_tipo_pago_casa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_basedatos_digital` ADD CONSTRAINT `FK_9BF4295A1CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_basedatos_digital` ADD CONSTRAINT `FK_9BF4295A952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_datos_adjuntos_rrhh` ADD CONSTRAINT `FK_FE891195A2DE568` FOREIGN KEY (`tipoDatoAdjunto_id`) REFERENCES `n_tipo_dato_adjunto_rrhh`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_datos_adjuntos_rrhh` ADD CONSTRAINT `FK_FE89119952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_gasto_principal` ADD CONSTRAINT `FK_6136C13518864C8` FOREIGN KEY (`egastoprincipal_id`) REFERENCES `e_gasto_principal`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_gasto_principal` ADD CONSTRAINT `FK_6136C13DAB52E4B` FOREIGN KEY (`cempleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D3C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D41859289` FOREIGN KEY (`division_id`) REFERENCES `n_division`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D4959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D5035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D5CAEAC5D` FOREIGN KEY (`ejecutivoCuenta_id`) REFERENCES `n_ejecutivo_cuenta`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D70AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308D952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308DDE734E51` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_plaza` ADD CONSTRAINT `FK_9F05308DEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_referencias` ADD CONSTRAINT `FK_E5ADCE2D1CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_referencias` ADD CONSTRAINT `FK_E5ADCE2D2BAEF284` FOREIGN KEY (`estadoCivil_id`) REFERENCES `n_estado_civil`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_referencias` ADD CONSTRAINT `FK_E5ADCE2D952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_referencias` ADD CONSTRAINT `FK_E5ADCE2DD3F1ED37` FOREIGN KEY (`clasificacionReferencia_id`) REFERENCES `n_clasificacion_referencia`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_registro_laboral` ADD CONSTRAINT `FK_30CD41E5952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_registro_laboral` ADD CONSTRAINT `FK_30CD41E5AC3051D` FOREIGN KEY (`tipoRegistroLaboral_id`) REFERENCES `n_tipo_registro_laboral`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_sindicato` ADD CONSTRAINT `FK_7F8A7D598D7C55D2` FOREIGN KEY (`sindicato_id`) REFERENCES `n_sindicato`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_sindicato` ADD CONSTRAINT `FK_7F8A7D59952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_sindicato_adjuntos` ADD CONSTRAINT `FK_2CD97FCF6F9D0169` FOREIGN KEY (`empleado_sindicato_id`) REFERENCES `c_empleado_sindicato`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_empleado_tramite_portacion_arma` ADD CONSTRAINT `FK_E46810F952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_extra_limite_semanal` ADD CONSTRAINT `FK_A0512A95952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_extra_tarifa_corpo` ADD CONSTRAINT `FK_E3FAC1FB279A5D5E` FOREIGN KEY (`sucursal_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_extra_tarifa_corpo` ADD CONSTRAINT `FK_E3FAC1FB3AD4FFE2` FOREIGN KEY (`cextratarifa_id`) REFERENCES `c_extra_tarifa`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_extra_tarifa_rango` ADD CONSTRAINT `FK_4E1AD678ED0E28FB` FOREIGN KEY (`extraTarifa_id`) REFERENCES `c_extra_tarifa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_fecha_excepcional` ADD CONSTRAINT `FK_403BB7FF4959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_fecha_excepcional` ADD CONSTRAINT `FK_403BB7FF952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_feriado_dia` ADD CONSTRAINT `FK_9B00E14AB1C52DFC` FOREIGN KEY (`feriadoCalendario_id`) REFERENCES `c_feriado_calendario`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horario_dia` ADD CONSTRAINT `FK_E719D4BD4959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horario_dia` ADD CONSTRAINT `FK_E719D4BDEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_horas_extras` ADD CONSTRAINT `FK_C_HORAS_EMPLEADO` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_incapacidad_ins` ADD CONSTRAINT `FK_80539B87521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_incapacidad_ins` ADD CONSTRAINT `FK_80539B87DE78DC57` FOREIGN KEY (`empresaPoliza_id`) REFERENCES `n_empresa_poliza`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_induccion` ADD CONSTRAINT `FK_371730A5035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_induccion` ADD CONSTRAINT `FK_371730A952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_induccion_dia` ADD CONSTRAINT `FK_E5590D543CEEDC64` FOREIGN KEY (`induccion_id`) REFERENCES `c_induccion`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_induccion_dia` ADD CONSTRAINT `FK_E5590D54EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E62B959FC6` FOREIGN KEY (`extra_id`) REFERENCES `c_horas_extras`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E681B56B3` FOREIGN KEY (`coordinadoPor_id`) REFERENCES `n_coordinado_por`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E6952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E6A65E775D` FOREIGN KEY (`empleadoDestino_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E6B304894A` FOREIGN KEY (`plazaDestino_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E6C968E4B9` FOREIGN KEY (`plazaOrigen_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_inducciones` ADD CONSTRAINT `FK_A3BC66E6E4517BDD` FOREIGN KEY (`coordinador_id`) REFERENCES `n_coordinador`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_intercambio_linea` ADD CONSTRAINT `FK_88E784CE4BC37A6F` FOREIGN KEY (`intercambio_id`) REFERENCES `c_intercambio`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_intercambio_linea` ADD CONSTRAINT `FK_88E784CE77BB7125` FOREIGN KEY (`plazaInicio_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_intercambio_linea` ADD CONSTRAINT `FK_88E784CE952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_intercambio_linea` ADD CONSTRAINT `FK_88E784CEAED3850` FOREIGN KEY (`plazaFin_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_intercambio_linea` ADD CONSTRAINT `FK_88E784CEF883EFAA` FOREIGN KEY (`empleadoSustituido_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_roltipoaccion_tipoaccion` ADD CONSTRAINT `FK_48CD1A52C9F2F869` FOREIGN KEY (`croltipoaccion_id`) REFERENCES `c_rol_tipoaccion`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_roltipoaccion_tipoaccion` ADD CONSTRAINT `FK_48CD1A52E93DD86B` FOREIGN KEY (`ctipoaccion_id`) REFERENCES `c_tipo_accion`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_separacion_temp` ADD CONSTRAINT `FK_540A8D7C9F59AD70` FOREIGN KEY (`empleadoTrasladoTemp_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C018586848` FOREIGN KEY (`tipoPortacionArmas_id`) REFERENCES `n_tipo_carnet_portacion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C02BAEF284` FOREIGN KEY (`estadoCivil_id`) REFERENCES `n_estado_civil`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C041859289` FOREIGN KEY (`division_id`) REFERENCES `n_division`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C04E7121AF` FOREIGN KEY (`provincia_id`) REFERENCES `n_provincia`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C06AC7D228` FOREIGN KEY (`terceraOpcionTrabajar_id`) REFERENCES `n_provincia`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C08B34DB71` FOREIGN KEY (`vacante_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C08D070D0B` FOREIGN KEY (`canton_id`) REFERENCES `n_canton`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C08E099F24` FOREIGN KEY (`primeraOpcionTrabajar_id`) REFERENCES `n_provincia`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C098260155` FOREIGN KEY (`region_id`) REFERENCES `n_region`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C0AB8DC0F8` FOREIGN KEY (`nacionalidad_id`) REFERENCES `n_nacionalidad`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C0B894E495` FOREIGN KEY (`segundaOpcionTrabajar_id`) REFERENCES `n_provincia`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo` ADD CONSTRAINT `FK_4F8484C0E557397E` FOREIGN KEY (`distrito_id`) REFERENCES `n_distrito`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitud_empleo_adjunto` ADD CONSTRAINT `FK_55893DCD1CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitudempleo__n_idioma` ADD CONSTRAINT `FK_38D7303214714E0A` FOREIGN KEY (`nidioma_id`) REFERENCES `n_idioma`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_solicitudempleo__n_idioma` ADD CONSTRAINT `FK_38D730324248037D` FOREIGN KEY (`csolicitudempleo_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_tramite_portacion_arma` ADD CONSTRAINT `FK_B71936626D892826` FOREIGN KEY (`empleadoTramitePortacionArma_id`) REFERENCES `c_empleado_tramite_portacion_arma`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `c_traslado_temp` ADD CONSTRAINT `FK_7B0E282C1B482BBB` FOREIGN KEY (`plazaInicial_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `consultor_actualizacion` ADD CONSTRAINT `FK_A7D941FB4E7121AF` FOREIGN KEY (`provincia_id`) REFERENCES `n_provincia`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `consultor_actualizacion` ADD CONSTRAINT `FK_A7D941FB8D070D0B` FOREIGN KEY (`canton_id`) REFERENCES `n_canton`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `consultor_actualizacion` ADD CONSTRAINT `FK_A7D941FB952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `consultor_actualizacion` ADD CONSTRAINT `FK_A7D941FBE557397E` FOREIGN KEY (`distrito_id`) REFERENCES `n_distrito`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `consultor_actualizacion_telefonos` ADD CONSTRAINT `FK_2CF2054CDF01D38` FOREIGN KEY (`actualizacion_id`) REFERENCES `consultor_actualizacion`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `consultor_history_checked_update` ADD CONSTRAINT `FK_37A84590952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `consultor_log` ADD CONSTRAINT `FK_45A0E79B1CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `v_vacacion_solicitud`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `consultor_log` ADD CONSTRAINT `FK_45A0E79B952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `d_empleado_cartas_recomendacion` ADD CONSTRAINT `FK_244336C1CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `d_empleado_cartas_recomendacion` ADD CONSTRAINT `FK_244336C952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `d_empleado_hoja_delincuencia` ADD CONSTRAINT `FK_D39F3EAF1CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `d_empleado_hoja_delincuencia` ADD CONSTRAINT `FK_D39F3EAF952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `d_empleado_otras_anotaciones` ADD CONSTRAINT `FK_CAA044011CB9D6E4` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_empleo`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `d_empleado_otras_anotaciones` ADD CONSTRAINT `FK_CAA04401952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_antecedente_penal` ADD CONSTRAINT `FK_47E60268952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_cuenta_banco_empleado` ADD CONSTRAINT `FK_DBE7C3CB952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_cuenta_banco_empleado` ADD CONSTRAINT `FK_DBE7C3CBCC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_cursos` ADD CONSTRAINT `FK_2B0E1353952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_dato_legal` ADD CONSTRAINT `FK_3E0AEB71952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_domicilio` ADD CONSTRAINT `FK_7F866C2C952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_domicilio` ADD CONSTRAINT `FK_7F866C2C98260155` FOREIGN KEY (`region_id`) REFERENCES `n_region`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_domicilio` ADD CONSTRAINT `FK_7F866C2CE557397E` FOREIGN KEY (`distrito_id`) REFERENCES `n_distrito`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_educacion` ADD CONSTRAINT `FK_F2D67309952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_educacion_idiomas` ADD CONSTRAINT `FK_52B18791952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_educacion_idiomas` ADD CONSTRAINT `FK_52B18791DEDC0611` FOREIGN KEY (`idioma_id`) REFERENCES `n_idioma`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_empleado_incumplimiento` ADD CONSTRAINT `FK_7D24EC63952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_empleado_incumplimiento` ADD CONSTRAINT `FK_7D24EC63B0DCC882` FOREIGN KEY (`tipoSancionAplicada_id`) REFERENCES `n_tipo_sancion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_empleado_incumplimiento__n_motivo` ADD CONSTRAINT `FK_A8E899CD37734155` FOREIGN KEY (`eincumplimiento_id`) REFERENCES `e_empleado_incumplimiento`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_empleado_incumplimiento__n_motivo` ADD CONSTRAINT `FK_A8E899CD517A96A9` FOREIGN KEY (`nmotivoincumplimiento_id`) REFERENCES `n_motivo_incumplimiento`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_empleado_incumplimiento_accion` ADD CONSTRAINT `FK_5FD783337734155` FOREIGN KEY (`eincumplimiento_id`) REFERENCES `e_empleado_incumplimiento`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_empleado_lista_negra` ADD CONSTRAINT `FK_69D24DF1279A5D5E` FOREIGN KEY (`sucursal_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_empleado_lista_negra` ADD CONSTRAINT `FK_69D24DF1952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_empleado_lista_negra` ADD CONSTRAINT `FK_69D24DF1DE734E51` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_entrega` ADD CONSTRAINT `FK_9BAD26993C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_entrega` ADD CONSTRAINT `FK_9BAD26995035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_entrega` ADD CONSTRAINT `FK_9BAD269985828A9B` FOREIGN KEY (`nomencladorArticuloCP_id`) REFERENCES `n_articulo_corpo_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` ADD CONSTRAINT `FK_AAD537C43C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` ADD CONSTRAINT `FK_AAD537C45035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` ADD CONSTRAINT `FK_AAD537C4EB6587E3` FOREIGN KEY (`combo_id`) REFERENCES `e_estructura_combo_articulo_cp`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_articulo_corpo_puesto_plan` ADD CONSTRAINT `FK_AAD537C4EDDDC6B` FOREIGN KEY (`articuloCP_id`) REFERENCES `n_articulo_corpo_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_bonificaciones_plaza` ADD CONSTRAINT `FK_89391A8D86CE56DC` FOREIGN KEY (`bonificacion_id`) REFERENCES `n_bonificacion_plaza`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_bonificaciones_plaza` ADD CONSTRAINT `FK_89391A8DEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_cliente` ADD CONSTRAINT `FK_AE021871521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_cliente_usuario` ADD CONSTRAINT `FK_E039927BA76ED395` FOREIGN KEY (`user_id`) REFERENCES `security_fos_user`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_cliente_usuario` ADD CONSTRAINT `FK_E039927BDE734E51` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_contrato` ADD CONSTRAINT `FK_A35EE4D41859289` FOREIGN KEY (`division_id`) REFERENCES `n_division`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_contrato` ADD CONSTRAINT `FK_A35EE4D4FF0676` FOREIGN KEY (`tipoContrato_id`) REFERENCES `n_tipo_contrato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_contrato` ADD CONSTRAINT `FK_A35EE4D521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_contrato` ADD CONSTRAINT `FK_A35EE4D76490E74` FOREIGN KEY (`lugarApertura_id`) REFERENCES `n_lugar_apertura`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_contrato` ADD CONSTRAINT `FK_A35EE4DDE734E51` FOREIGN KEY (`cliente_id`) REFERENCES `e_estructura_cliente`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_curso_contrato` ADD CONSTRAINT `FK_93FF31DC70AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_curso_contrato` ADD CONSTRAINT `FK_93FF31DC87CB4A1F` FOREIGN KEY (`curso_id`) REFERENCES `c_curso`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_dia_excepcion_plaza` ADD CONSTRAINT `FK_640C22F132838645` FOREIGN KEY (`diaExcepcionPuesto_id`) REFERENCES `e_estructura_dia_excepcion_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_dia_excepcion_plaza` ADD CONSTRAINT `FK_640C22F1EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_dia_excepcion_puesto` ADD CONSTRAINT `FK_1F27E2D35035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_empleado_autorizado_contrato` ADD CONSTRAINT `FK_8E302ED270AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_empleado_autorizado_contrato` ADD CONSTRAINT `FK_8E302ED2952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_historico_contrato` ADD CONSTRAINT `FK_688D970F70AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_historico_contrato` ADD CONSTRAINT `FK_688D970F84F63C81` FOREIGN KEY (`tipoRegistroContrato_id`) REFERENCES `n_tipo_registro_contrato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_horario_plaza_historial` ADD CONSTRAINT `FK_F4AAD92F4959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_horario_plaza_historial` ADD CONSTRAINT `FK_F4AAD92FEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_horariopuesto_dia` ADD CONSTRAINT `FK_2968410A4959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `e_estructura_horariopuesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_plazas` ADD CONSTRAINT `FK_92687E504BAB96C` FOREIGN KEY (`rol_id`) REFERENCES `c_horario`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_plazas` ADD CONSTRAINT `FK_92687E505035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_plazas` ADD CONSTRAINT `FK_92687E5066A839D6` FOREIGN KEY (`empleadoPlaza_id`) REFERENCES `c_empleado_plaza`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_plazas` ADD CONSTRAINT `FK_92687E50A07740F` FOREIGN KEY (`comboUniforme_id`) REFERENCES `c_combo_uniforme_plaza`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_plazas` ADD CONSTRAINT `FK_92687E50F4C2234D` FOREIGN KEY (`categoriaSalarial_id`) REFERENCES `pg_categoria_salarial`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_puesto` ADD CONSTRAINT `FK_5C9F9D20279A5D5E` FOREIGN KEY (`sucursal_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_puesto` ADD CONSTRAINT `FK_5C9F9D202AC174D0` FOREIGN KEY (`tipoPuesto_id`) REFERENCES `n_tipo_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_puesto` ADD CONSTRAINT `FK_5C9F9D207A17505D` FOREIGN KEY (`comboArticulosCP_id`) REFERENCES `e_estructura_combo_articulo_cp`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_puesto` ADD CONSTRAINT `FK_5C9F9D209FF23C2C` FOREIGN KEY (`horarioPuesto_id`) REFERENCES `e_estructura_horariopuesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_puesto` ADD CONSTRAINT `FK_5C9F9D20EB6A1B22` FOREIGN KEY (`tipoHoraExtra_id`) REFERENCES `n_horas_extras`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_requerimiento_contrato` ADD CONSTRAINT `FK_D5DEDC5251DD0900` FOREIGN KEY (`requerimiento_id`) REFERENCES `n_requerimiento`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_requerimiento_contrato` ADD CONSTRAINT `FK_D5DEDC5270AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E6384E7121AF` FOREIGN KEY (`provincia_id`) REFERENCES `n_provincia`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E6385CAEAC5D` FOREIGN KEY (`ejecutivoCuenta_id`) REFERENCES `n_ejecutivo_cuenta`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E63870AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E6387A17505D` FOREIGN KEY (`comboArticulosCP_id`) REFERENCES `e_estructura_combo_articulo_cp`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E6388D070D0B` FOREIGN KEY (`canton_id`) REFERENCES `n_canton`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E63898260155` FOREIGN KEY (`region_id`) REFERENCES `n_region`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_estructura_sucursal` ADD CONSTRAINT `FK_85C0E638E557397E` FOREIGN KEY (`distrito_id`) REFERENCES `n_distrito`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_familia` ADD CONSTRAINT `FK_BFFE2C1E5BA311FC` FOREIGN KEY (`parentesco_id`) REFERENCES `n_parentesco`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_familia` ADD CONSTRAINT `FK_BFFE2C1E952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_familia` ADD CONSTRAINT `FK_BFFE2C1ED8999C67` FOREIGN KEY (`ocupacion_id`) REFERENCES `n_ocupacion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_historia_salud` ADD CONSTRAINT `FK_DBC9ED35952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_historia_salud_deportes` ADD CONSTRAINT `FK_C8CA2E312AC5252B` FOREIGN KEY (`ehistoriasalud_id`) REFERENCES `e_historia_salud`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_historia_salud_deportes` ADD CONSTRAINT `FK_C8CA2E31CE01478D` FOREIGN KEY (`ndeportes_id`) REFERENCES `n_deportes`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_historia_salud_juego_azar` ADD CONSTRAINT `FK_A5E83ADC2AC5252B` FOREIGN KEY (`ehistoriasalud_id`) REFERENCES `e_historia_salud`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_historia_salud_juego_azar` ADD CONSTRAINT `FK_A5E83ADCCB6A38C4` FOREIGN KEY (`njuegoazar_id`) REFERENCES `n_juego_azar`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_historia_salud_tipo_enfermedad` ADD CONSTRAINT `FK_68A643A55E542676` FOREIGN KEY (`tipoEnfermedad_id`) REFERENCES `n_tipo_enfermedad`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_historia_salud_tipo_enfermedad` ADD CONSTRAINT `FK_68A643A571AC4617` FOREIGN KEY (`historiaSalud_id`) REFERENCES `e_historia_salud`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_historia_trabajo` ADD CONSTRAINT `FK_C3C4D66952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_informacion_educacional` ADD CONSTRAINT `FK_4ECC8A5654204EE1` FOREIGN KEY (`nivelEducacional_id`) REFERENCES `n_nivel_educacional`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_informacion_educacional` ADD CONSTRAINT `FK_4ECC8A568ED81F31` FOREIGN KEY (`educacion_id`) REFERENCES `e_educacion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_licencia` ADD CONSTRAINT `FK_209564874E5E27A4` FOREIGN KEY (`tipoLicencia_id`) REFERENCES `n_tipo_licencia`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_licencia` ADD CONSTRAINT `FK_20956487952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_persona_dependen` ADD CONSTRAINT `FK_708D21555BA311FC` FOREIGN KEY (`parentesco_id`) REFERENCES `n_parentesco`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_persona_dependen` ADD CONSTRAINT `FK_708D2155952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_persona_dependen` ADD CONSTRAINT `FK_708D2155D8999C67` FOREIGN KEY (`ocupacion_id`) REFERENCES `n_ocupacion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_persona_empresa` ADD CONSTRAINT `FK_61EEE3DCA57A8FE0` FOREIGN KEY (`otrosDatos_id`) REFERENCES `e_otros_datos`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_referencia_personal` ADD CONSTRAINT `FK_BFAFF6A4952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_registro_enfermedades` ADD CONSTRAINT `FK_946DE77A952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_registro_habilidades` ADD CONSTRAINT `FK_7BA0E6E9952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_requerimiento_cumplido` ADD CONSTRAINT `FK_BB503B1551DD0900` FOREIGN KEY (`requerimiento_id`) REFERENCES `n_requerimiento`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_requerimiento_cumplido` ADD CONSTRAINT `FK_BB503B15952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_trabajo` ADD CONSTRAINT `FK_1C41565B952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `e_trabajo` ADD CONSTRAINT `FK_1C41565BC2D4D747` FOREIGN KEY (`nombre_id`) REFERENCES `n_trabajo`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `log_horario` ADD CONSTRAINT `FK_DA956B344959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_comodin_ausente` ADD CONSTRAINT `FK_512A0FBD952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_puesto_no_cubierto` ADD CONSTRAINT `FK_61ED7883952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_puesto_no_cubierto` ADD CONSTRAINT `FK_61ED7883C49D574A` FOREIGN KEY (`reposicionDeHoras_id`) REFERENCES `m_reposicion_de_horas`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_puesto_no_cubierto` ADD CONSTRAINT `FK_61ED7883EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_refuerzo` ADD CONSTRAINT `FK_E14C49FC2B959FC6` FOREIGN KEY (`extra_id`) REFERENCES `c_horas_extras`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_refuerzo` ADD CONSTRAINT `FK_E14C49FC3C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_refuerzo` ADD CONSTRAINT `FK_E14C49FC952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_refuerzo` ADD CONSTRAINT `FK_E14C49FCEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_reposicion_de_horas` ADD CONSTRAINT `FK_35E7E0D45035E9DA` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_reposicion_de_horas` ADD CONSTRAINT `FK_35E7E0D4952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_rol_monitoreo_contrato` ADD CONSTRAINT `FK_98623F170AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_rol_monitoreo_contrato` ADD CONSTRAINT `FK_98623F1CECCB70E` FOREIGN KEY (`mrolmonitoreo_id`) REFERENCES `m_rol_monitoreo`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_rol_monitoreo_sucursal` ADD CONSTRAINT `FK_86732B84279A5D5E` FOREIGN KEY (`sucursal_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_rol_monitoreo_sucursal` ADD CONSTRAINT `FK_86732B84CECCB70E` FOREIGN KEY (`mrolmonitoreo_id`) REFERENCES `m_rol_monitoreo`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `m_turno_activo` ADD CONSTRAINT `FK_CC1DB0AE2F4E077F` FOREIGN KEY (`motivoMarcarHorarioPlaza_id`) REFERENCES `n_motivo_marcar_horario_plaza`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `n_apoderado` ADD CONSTRAINT `FK_2D844777952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `n_articulo_uniforme` ADD CONSTRAINT `FK_429432F081E7650` FOREIGN KEY (`tipoDeTalla_id`) REFERENCES `n_clasificacion_talla`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `n_canton` ADD CONSTRAINT `FK_9F82AC3C4E7121AF` FOREIGN KEY (`provincia_id`) REFERENCES `n_provincia`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `n_coordinador` ADD CONSTRAINT `FK_D7D149E781B56B3` FOREIGN KEY (`coordinadoPor_id`) REFERENCES `n_coordinado_por`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `n_distrito` ADD CONSTRAINT `FK_5A4A14868D070D0B` FOREIGN KEY (`canton_id`) REFERENCES `n_canton`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `n_empresa_banco` ADD CONSTRAINT `FK_F5709BC0521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `n_empresa_banco` ADD CONSTRAINT `FK_F5709BC0CC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `n_empresa_poliza` ADD CONSTRAINT `FK_1223BAD041859289` FOREIGN KEY (`division_id`) REFERENCES `n_division`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `n_empresa_poliza` ADD CONSTRAINT `FK_1223BAD0521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `n_motivo_extra` ADD CONSTRAINT `FK_A3B0B86EB5523D4D` FOREIGN KEY (`tipoExtra_id`) REFERENCES `n_tipo_extra`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `n_pago_turno` ADD CONSTRAINT `FK_971CFF176065BC38` FOREIGN KEY (`categoriaPlaza_id`) REFERENCES `pg_categoria_salarial`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `n_pago_turno` ADD CONSTRAINT `FK_971CFF1769C5211E` FOREIGN KEY (`turno_id`) REFERENCES `n_turno`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `n_requerimiento` ADD CONSTRAINT `FK_529C438AB1D10646` FOREIGN KEY (`requerimiento_padre_id`) REFERENCES `n_requerimiento`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `p_periodopago` ADD CONSTRAINT `FK_31023814D035117` FOREIGN KEY (`periodoPagoConfig_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `p_planillas` ADD CONSTRAINT `FK_A4977423D2624C39` FOREIGN KEY (`periodoPago_id`) REFERENCES `p_periodopago`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `p_planillas_bonificaciones_pagadas` ADD CONSTRAINT `FK_12CD2767799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `p_planillas_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `p_planillas_bonificaciones_pagadas` ADD CONSTRAINT `FK_12CD276786CE56DC` FOREIGN KEY (`bonificacion_id`) REFERENCES `c_bonificaciones`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `p_planillas_bonificaciones_plaza_pagadas` ADD CONSTRAINT `FK_9F2F7DE7799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `p_planillas_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `p_planillas_bonificaciones_plaza_pagadas` ADD CONSTRAINT `FK_9F2F7DE7E084692E` FOREIGN KEY (`bonificacionPlaza_id`) REFERENCES `e_estructura_bonificaciones_plaza`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `p_planillas_deudas_pagadas` ADD CONSTRAINT `FK_A96F6365799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `p_planillas_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `p_planillas_deudas_pagadas` ADD CONSTRAINT `FK_A96F6365C5CAD3D1` FOREIGN KEY (`deuda_id`) REFERENCES `c_deudas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `p_planillas_dia_menos_descontado` ADD CONSTRAINT `FK_DBC74561799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `p_planillas_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `p_planillas_empleado` ADD CONSTRAINT `FK_CC9DC074952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `p_planillas_empleado` ADD CONSTRAINT `FK_CC9DC074F747F090` FOREIGN KEY (`planilla_id`) REFERENCES `p_planillas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_categoria_salarial` ADD CONSTRAINT `FK_E3A1F6CBED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_categoria_salarial_log` ADD CONSTRAINT `FK_5C4E2930ED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_categoria_salarial_log` ADD CONSTRAINT `FK_5C4E2930F4C2234D` FOREIGN KEY (`categoriaSalarial_id`) REFERENCES `pg_categoria_salarial`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pago_turno_semanal` ADD CONSTRAINT `FK_99D45AACED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pago_turno_semanal_log` ADD CONSTRAINT `FK_C845571FA0E9F09B` FOREIGN KEY (`pagoTurnoSemanal_id`) REFERENCES `pg_pago_turno_semanal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pago_turno_semanal_log` ADD CONSTRAINT `FK_C845571FED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_bonif_empl_pagado` ADD CONSTRAINT `FK_1ED55932799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_bonif_empl_pagado` ADD CONSTRAINT `FK_1ED5593286CE56DC` FOREIGN KEY (`bonificacion_id`) REFERENCES `c_bonificaciones`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_bonif_plaza_pagado` ADD CONSTRAINT `FK_AB69EBC4799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_bonif_plaza_pagado` ADD CONSTRAINT `FK_AB69EBC486CE56DC` FOREIGN KEY (`bonificacion_id`) REFERENCES `e_estructura_bonificaciones_plaza`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_deuda_descontado` ADD CONSTRAINT `FK_8BF9D6E9799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_deuda_descontado` ADD CONSTRAINT `FK_8BF9D6E9C5CAD3D1` FOREIGN KEY (`deuda_id`) REFERENCES `c_deudas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_dia` ADD CONSTRAINT `FK_11D3EF533FBAC2B` FOREIGN KEY (`planillaEmpleadoRdh_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_dia` ADD CONSTRAINT `FK_11D3EF53436B53E8` FOREIGN KEY (`planillaEmpleadoCdg_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_dia` ADD CONSTRAINT `FK_11D3EF53799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_feriado_dia_pagado` ADD CONSTRAINT `FK_EAF51CE1799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_feriado_dia_pagado` ADD CONSTRAINT `FK_EAF51CE1E2194A39` FOREIGN KEY (`feriadoDia_id`) REFERENCES `c_feriado_dia`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_incapacidad_pagado` ADD CONSTRAINT `FK_FEB9C1B02EDBF996` FOREIGN KEY (`incapacidad_id`) REFERENCES `c_incapacidad_ccss`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_incapacidad_pagado` ADD CONSTRAINT `FK_FEB9C1B0799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_induccion_dia_pagado` ADD CONSTRAINT `FK_869A86811D6FE1F6` FOREIGN KEY (`induccionDia_id`) REFERENCES `c_inducciones`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_induccion_dia_pagado` ADD CONSTRAINT `FK_869A8681799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_rebajo_sindicato_pagado` ADD CONSTRAINT `FK_D0FCC65257F57AE7` FOREIGN KEY (`planilla_empleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_rebajo_sindicato_pagado` ADD CONSTRAINT `FK_D0FCC6526F9D0169` FOREIGN KEY (`empleado_sindicato_id`) REFERENCES `c_empleado_sindicato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_refuerzo_dia_pagado` ADD CONSTRAINT `FK_C5D26D6632F8140A` FOREIGN KEY (`refuerzoDia_id`) REFERENCES `m_refuerzo`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_pe_refuerzo_dia_pagado` ADD CONSTRAINT `FK_C5D26D66799EE823` FOREIGN KEY (`planillaEmpleado_id`) REFERENCES `pg_planilla_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95E3C5F34F` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95E4959F1BA` FOREIGN KEY (`horario_id`) REFERENCES `c_horario`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95E70AE7BF1` FOREIGN KEY (`contrato_id`) REFERENCES `e_estructura_contrato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95E952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95EB1C7830E` FOREIGN KEY (`salarioMes_id`) REFERENCES `v_salario_mes`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95EEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_empleado` ADD CONSTRAINT `FK_1465F95EF747F090` FOREIGN KEY (`planilla_id`) REFERENCES `pg_planilla`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra` ADD CONSTRAINT `FK_3764CFDF521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra` ADD CONSTRAINT `FK_3764CFDFCC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra_empleado` ADD CONSTRAINT `FK_F9A77EA2521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra_empleado` ADD CONSTRAINT `FK_F9A77EA2952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra_empleado` ADD CONSTRAINT `FK_F9A77EA2CC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra_empleado` ADD CONSTRAINT `FK_F9A77EA2EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_planilla_extra_empleado` ADD CONSTRAINT `FK_F9A77EA2F747F090` FOREIGN KEY (`planilla_id`) REFERENCES `pg_planilla_extra`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pg_turno_excepcion` ADD CONSTRAINT `FK_9DAD81FEF4C2234D` FOREIGN KEY (`categoriaSalarial_id`) REFERENCES `pg_categoria_salarial`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871114FAA7C` FOREIGN KEY (`educacionTecnico_id`) REFERENCES `n_educacion_tecnico`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B87128F0D5CA` FOREIGN KEY (`escolaridad_id`) REFERENCES `n_escolaridad`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B8712BAEF284` FOREIGN KEY (`estadoCivil_id`) REFERENCES `n_estado_civil`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B87155CD1AE4` FOREIGN KEY (`educacionUniversidad_id`) REFERENCES `n_educacion_universidad`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B8715EEC5E1B` FOREIGN KEY (`educacionPrimaria_id`) REFERENCES `n_educacion_primaria`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B87179F98940` FOREIGN KEY (`seguroCaja_id`) REFERENCES `n_seguro_caja`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B8718D7C55D2` FOREIGN KEY (`sindicato_id`) REFERENCES `n_sindicato`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B8719297142` FOREIGN KEY (`empleadoAsociado_id`) REFERENCES `c_empleado`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871996BD967` FOREIGN KEY (`educacionSecundaria_id`) REFERENCES `n_educacion_secundaria`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871AB8DC0F8` FOREIGN KEY (`nacionalidad_id`) REFERENCES `n_nacionalidad`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871B0B41592` FOREIGN KEY (`tipoContratacion_id`) REFERENCES `n_tipo_contratacion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871B7B147D6` FOREIGN KEY (`importacionEmpleados_id`) REFERENCES `s_importacion_empleados`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871CC04A73E` FOREIGN KEY (`banco_id`) REFERENCES `n_banco`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871D2624C39` FOREIGN KEY (`periodoPago_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871ED33694C` FOREIGN KEY (`categoriaEmpleado_id`) REFERENCES `pg_categoria_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado` ADD CONSTRAINT `FK_EFE4B871FCBB0AEC` FOREIGN KEY (`tipoPagoCasa_id`) REFERENCES `n_tipo_pago_casa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_empleado_plaza` ADD CONSTRAINT `FK_79220E13EF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `s_planilla` ADD CONSTRAINT `FK_A2ED8530521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `security_fos_user` ADD CONSTRAINT `FK_F611E3AB5CAEAC5D` FOREIGN KEY (`ejecutivoCuenta_id`) REFERENCES `n_ejecutivo_cuenta`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `security_fos_user` ADD CONSTRAINT `FK_F611E3AB81B56B3` FOREIGN KEY (`coordinadoPor_id`) REFERENCES `n_coordinado_por`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `security_fos_user` ADD CONSTRAINT `FK_F611E3ABE4517BDD` FOREIGN KEY (`coordinador_id`) REFERENCES `n_coordinador`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `security_fos_users_divisiones` ADD CONSTRAINT `FK_ECB7EF6390B45A1C` FOREIGN KEY (`ndivision_id`) REFERENCES `n_division`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `security_fos_users_divisiones` ADD CONSTRAINT `FK_ECB7EF63A76ED395` FOREIGN KEY (`user_id`) REFERENCES `security_fos_user`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `security_fos_users_groups` ADD CONSTRAINT `FK_195E7B04A76ED395` FOREIGN KEY (`user_id`) REFERENCES `security_fos_user`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `security_fos_users_groups` ADD CONSTRAINT `FK_195E7B04FE54D947` FOREIGN KEY (`group_id`) REFERENCES `security_fos_group`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `security_fos_users_roles_monitoreo` ADD CONSTRAINT `FK_6B6023C2A76ED395` FOREIGN KEY (`user_id`) REFERENCES `security_fos_user`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `security_fos_users_roles_monitoreo` ADD CONSTRAINT `FK_6B6023C2CECCB70E` FOREIGN KEY (`mrolmonitoreo_id`) REFERENCES `m_rol_monitoreo`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `security_fos_users_roles_tipoaccion` ADD CONSTRAINT `FK_D81D1251A76ED395` FOREIGN KEY (`user_id`) REFERENCES `security_fos_user`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `security_fos_users_roles_tipoaccion` ADD CONSTRAINT `FK_D81D1251C9F2F869` FOREIGN KEY (`croltipoaccion_id`) REFERENCES `c_rol_tipoaccion`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_planilla_aguinaldo` ADD CONSTRAINT `FK_349B745C521E1991` FOREIGN KEY (`empresa_id`) REFERENCES `e_estructura_empresa`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_planilla_aguinaldo_empleado` ADD CONSTRAINT `FK_3941B047952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_planilla_aguinaldo_empleado` ADD CONSTRAINT `FK_3941B047D45EF842` FOREIGN KEY (`planillaAguinaldo_id`) REFERENCES `v_planilla_aguinaldo`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_salario_mes` ADD CONSTRAINT `FK_E9F02E60952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_salario_mes` ADD CONSTRAINT `FK_E9F02E60ACF1D1A2` FOREIGN KEY (`planillaAguinaldoEmpleado_id`) REFERENCES `v_planilla_aguinaldo_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_vacacion_empleado` ADD CONSTRAINT `FK_50A3975A952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_vacacion_mes` ADD CONSTRAINT `FK_5B04062661CD3BE2` FOREIGN KEY (`vacacionEmpleado_id`) REFERENCES `v_vacacion_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDA6D3EA93A` FOREIGN KEY (`sustituto_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDA7F5F4055` FOREIGN KEY (`motivoRechazo_id`) REFERENCES `n_motivo_rechazo_solicitud_vacacion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDA81B56B3` FOREIGN KEY (`coordinadoPor_id`) REFERENCES `n_coordinado_por`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDA952BE730` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDAD2624C39` FOREIGN KEY (`periodoPago_id`) REFERENCES `p_periodopago_config`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDAE4517BDD` FOREIGN KEY (`coordinador_id`) REFERENCES `n_coordinador`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `v_vacacion_solicitud` ADD CONSTRAINT `FK_98808EDAEF34C0BD` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
