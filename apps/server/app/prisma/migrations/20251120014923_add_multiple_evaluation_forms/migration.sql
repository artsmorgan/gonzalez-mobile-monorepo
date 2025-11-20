/*
  Warnings:

  - You are about to alter the column `created_at` on the `c_evaluacion` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_entrada` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_entrada` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `c_evaluacion` MODIFY `created_at` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_registro_personas` MODIFY `hora_entrada` DATETIME NOT NULL,
    MODIFY `hora_salida` DATETIME NULL,
    MODIFY `created_at` DATETIME NOT NULL,
    MODIFY `updated_at` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_registro_vehiculos` MODIFY `hora_entrada` DATETIME NOT NULL,
    MODIFY `hora_salida` DATETIME NULL,
    MODIFY `created_at` DATETIME NOT NULL,
    MODIFY `updated_at` DATETIME NOT NULL;

-- CreateTable
CREATE TABLE `c_solicitud_uniforme` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NULL,
    `nombre_completo` VARCHAR(191) NULL,
    `cliente_area` VARCHAR(191) NULL,
    `ultima_fecha_uniformes` VARCHAR(191) NULL,
    `talla_scrub_naranja` VARCHAR(191) NULL,
    `talla_pantalon` VARCHAR(191) NULL,
    `talla_zapatos` VARCHAR(191) NULL,
    `estado` VARCHAR(191) NULL,
    `persona_designada_entrega` VARCHAR(191) NULL,
    `no_procede_hasta` VARCHAR(191) NULL,
    `estatus_designado_entrega` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_satisfaccion_personal` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `nombre_empleado` VARCHAR(191) NULL,
    `cliente_sede` VARCHAR(191) NULL,
    `tiempo_laborado` VARCHAR(191) NULL,
    `recibe_uniformes_tiempo` VARCHAR(191) NULL,
    `llevo_induccion` VARCHAR(191) NULL,
    `calificacion_induccion` VARCHAR(191) NULL,
    `recibe_visitas_supervision` VARCHAR(191) NULL,
    `recibe_atencion_oficina` VARCHAR(191) NULL,
    `problemas_pago_resueltos` VARCHAR(191) NULL,
    `equipo_proteccion` VARCHAR(191) NULL,
    `que_mejorar` VARCHAR(191) NULL,
    `considera_empresa_debe_mejorar` VARCHAR(191) NULL,
    `conoce_reportar_accidente` VARCHAR(191) NULL,
    `le_gustaria_capacitado` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_planificacion_mantenimiento_vehiculo` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `nombre_vehiculo` VARCHAR(191) NULL,
    `matricula_vehiculo` VARCHAR(191) NULL,
    `mantenimientos` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_producto_no_conforme_matriz` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `cliente` VARCHAR(191) NULL,
    `numero_corpo` VARCHAR(191) NULL,
    `responsable_cuenta` VARCHAR(191) NULL,
    `macroactividad` VARCHAR(191) NULL,
    `actividad` VARCHAR(191) NULL,
    `tipo_servicio_no_conforme` VARCHAR(191) NULL,
    `tipo_registro` VARCHAR(191) NULL,
    `responsable_registro` VARCHAR(191) NULL,
    `acciones_seguir` LONGTEXT NULL,
    `responsable_corregir` LONGTEXT NULL,
    `responsable_aprobar` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_maestro_quejas` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `sociedad` VARCHAR(191) NULL,
    `nombre_realiza_queja` VARCHAR(191) NULL,
    `cliente` VARCHAR(191) NULL,
    `empresa_presenta_queja` VARCHAR(191) NULL,
    `persona_presenta_queja` VARCHAR(191) NULL,
    `medio_recepcion_queja` VARCHAR(191) NULL,
    `tipo_queja` VARCHAR(191) NULL,
    `ubicacion` VARCHAR(191) NULL,
    `nivel_queja` VARCHAR(191) NULL,
    `fecha_queja` VARCHAR(191) NULL,
    `motivo_queja` VARCHAR(191) NULL,
    `descripcion_queja` LONGTEXT NULL,
    `fecha_inicio` VARCHAR(191) NULL,
    `fecha_revision` VARCHAR(191) NULL,
    `resolucion_queja` LONGTEXT NULL,
    `mes_queja` VARCHAR(191) NULL,
    `ano_queja` VARCHAR(191) NULL,
    `estado` VARCHAR(191) NULL,
    `accion_correctiva_preventiva` VARCHAR(191) NULL,
    `anexo_evidencia` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_control_aseadores` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `nombre_aseador` VARCHAR(191) NULL,
    `oficina_despacho` VARCHAR(191) NULL,
    `provincia` VARCHAR(191) NULL,
    `canton` VARCHAR(191) NULL,
    `distrito` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `metraje` VARCHAR(191) NULL,
    `horario` VARCHAR(191) NULL,
    `horas_dia` VARCHAR(191) NULL,
    `horas_semana` VARCHAR(191) NULL,
    `dias` VARCHAR(191) NULL,
    `cantidad_personal` VARCHAR(191) NULL,
    `detalle_supervision` LONGTEXT NULL,
    `fecha_inicio` VARCHAR(191) NULL,
    `lista_equipos_insumos` LONGTEXT NULL,
    `costo_mensual` VARCHAR(191) NULL,
    `costo_anual` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NULL,
    `plaza` VARCHAR(191) NULL,
    `observaciones` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_agenda_minuta_fisica` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `fecha` VARCHAR(191) NULL,
    `puesto` VARCHAR(191) NULL,
    `hora_inicio` VARCHAR(191) NULL,
    `hora_fin` VARCHAR(191) NULL,
    `elaborado_por` VARCHAR(191) NULL,
    `minuta_numero` VARCHAR(191) NULL,
    `presentes` LONGTEXT NULL,
    `observaciones` LONGTEXT NULL,
    `temas_tratados` LONGTEXT NULL,
    `notas` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_plan_accion` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `nombre_lugar` VARCHAR(191) NULL,
    `fecha_inicio_operaciones` VARCHAR(191) NULL,
    `tareas` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_rol_trabajo` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `area` VARCHAR(191) NULL,
    `metraje` VARCHAR(191) NULL,
    `horario` VARCHAR(191) NULL,
    `personal` VARCHAR(191) NULL,
    `horarios` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_datos_basicos_contrato` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `fecha_inicio_contrato` VARCHAR(191) NULL,
    `cliente_contrato` VARCHAR(191) NULL,
    `ejecutivo_gerente_asistente` VARCHAR(191) NULL,
    `personal` LONGTEXT NULL,
    `lugar_servicio` VARCHAR(191) NULL,
    `roles_horarios` LONGTEXT NULL,
    `desglose_salarios` LONGTEXT NULL,
    `tipo_uniforme` LONGTEXT NULL,
    `tipo_arma` LONGTEXT NULL,
    `capacitaciones` LONGTEXT NULL,
    `otros_datos` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_cronograma_entrega_materiales_equipos` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `contrato` VARCHAR(191) NULL,
    `region` VARCHAR(191) NULL,
    `puesto` VARCHAR(191) NULL,
    `fecha_apertura_entrega` VARCHAR(191) NULL,
    `responsable_apertura_entrega` VARCHAR(191) NULL,
    `equipos_solicitados` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_rutas_giras` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `sociedad` VARCHAR(191) NULL,
    `cliente` VARCHAR(191) NULL,
    `zona` VARCHAR(191) NULL,
    `cantidad_personal` VARCHAR(191) NULL,
    `gira_ruta` VARCHAR(191) NULL,
    `dia_entrega` VARCHAR(191) NULL,
    `estatus` VARCHAR(191) NULL,
    `cumplimiento_supervision` VARCHAR(191) NULL,
    `cumplimiento_entrega_insumos` VARCHAR(191) NULL,
    `persona_refuerzo` VARCHAR(191) NULL,
    `notas_cambios` VARCHAR(191) NULL,
    `estado` VARCHAR(191) NULL,
    `nombre_persona_refuerzo` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
