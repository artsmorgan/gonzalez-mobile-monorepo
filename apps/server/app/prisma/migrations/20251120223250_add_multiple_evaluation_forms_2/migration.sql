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
CREATE TABLE `c_plan_gestion_ambiental` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `ubicacion` VARCHAR(191) NULL,
    `objetivo` LONGTEXT NULL,
    `metodologia` LONGTEXT NULL,
    `rol_horario` LONGTEXT NULL,
    `uniformes` LONGTEXT NULL,
    `equipos` LONGTEXT NULL,
    `accesorios_varios` LONGTEXT NULL,
    `tiempo_respuesta` LONGTEXT NULL,
    `distribucion_labores` LONGTEXT NULL,
    `frecuencia_limpieza` LONGTEXT NULL,
    `supervision` LONGTEXT NULL,
    `estrategia` LONGTEXT NULL,
    `responsable` LONGTEXT NULL,
    `formularios` LONGTEXT NULL,
    `plan_capacitacion` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_plan_trabajo_aseo_limpieza` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `objetivo` LONGTEXT NULL,
    `metodologia_trabajo_ambitos_accion` LONGTEXT NULL,
    `rol_horario_trabajo` LONGTEXT NULL,
    `uniformes` LONGTEXT NULL,
    `equipos` LONGTEXT NULL,
    `accesorios_varios` LONGTEXT NULL,
    `tiempo_respuesta_disposicion_imprevistos` LONGTEXT NULL,
    `distribucion_diaria_labores_personal` LONGTEXT NULL,
    `frecuencia_minima_limpieza_areas` LONGTEXT NULL,
    `supervision_metodo_rol_visitas` LONGTEXT NULL,
    `estrategia_adecuado_continuo_servicio` LONGTEXT NULL,
    `responsable_general_contrato` LONGTEXT NULL,
    `formularios_registro_control_puestos_equipos` LONGTEXT NULL,
    `plan_capacitacion` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_plan_atencion_situaciones_especiales` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `edificio` VARCHAR(191) NULL,
    `supervisor` VARCHAR(191) NULL,
    `situaciones` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_registro_tareas_actividades_limpieza` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `miscelaneo` VARCHAR(191) NULL,
    `area_piso` VARCHAR(191) NULL,
    `turno_inicio` VARCHAR(191) NULL,
    `turno_fin` VARCHAR(191) NULL,
    `mes` VARCHAR(191) NULL,
    `supervisor` VARCHAR(191) NULL,
    `sucursal` VARCHAR(191) NULL,
    `area` VARCHAR(191) NULL,
    `cliente` VARCHAR(191) NULL,
    `actividades_ejecucion_diaria` LONGTEXT NULL,
    `actividades_ejecucion_semanal` LONGTEXT NULL,
    `actividades_quincenales` LONGTEXT NULL,
    `actividades_mensual` LONGTEXT NULL,
    `actividades_bimensual` LONGTEXT NULL,
    `actividades_trimestral` LONGTEXT NULL,
    `actividades_cuatrimestral` LONGTEXT NULL,
    `actividades_semestral` LONGTEXT NULL,
    `actividades_anual` LONGTEXT NULL,
    `otras_actividades` LONGTEXT NULL,
    `programa_eventos_especiales` LONGTEXT NULL,
    `firma_miscelaneo` LONGTEXT NULL,
    `firma_supervisor` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_matriz_riesgos` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `riesgos` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_matriz_oportunidades` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `oportunidades` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_matriz_indicador_procesos` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `procesos` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_rol_trabajo_mensual` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `mes_ano` VARCHAR(191) NULL,
    `cliente` VARCHAR(191) NULL,
    `empleados` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_solicitud_permiso` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `persona_solicita` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NULL,
    `contrato` VARCHAR(191) NULL,
    `horario` VARCHAR(191) NULL,
    `fecha_solicitud` VARCHAR(191) NULL,
    `motivo_permiso` LONGTEXT NULL,
    `permiso_sustituido_por` VARCHAR(191) NULL,
    `codigo_sustituto` VARCHAR(191) NULL,
    `firma_gerente` LONGTEXT NULL,
    `firma_encargado_monitoreo` LONGTEXT NULL,
    `permiso_coordinado_por` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_control_asistencia` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `cliente` VARCHAR(191) NULL,
    `fecha` VARCHAR(191) NULL,
    `turno` VARCHAR(191) NULL,
    `area_piso` VARCHAR(191) NULL,
    `total_presentes` VARCHAR(191) NULL,
    `fijos` VARCHAR(191) NULL,
    `colaboradores` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_apertura_cierre_puesto` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `cliente` VARCHAR(191) NULL,
    `numero_corpo` VARCHAR(191) NULL,
    `numero_puesto` VARCHAR(191) NULL,
    `fecha_realizado` VARCHAR(191) NULL,
    `nombre_corpo` VARCHAR(191) NULL,
    `nombre_puesto` VARCHAR(191) NULL,
    `tipo` VARCHAR(191) NULL,
    `actividades` LONGTEXT NULL,
    `inventario` LONGTEXT NULL,
    `fotos` LONGTEXT NULL,
    `otras_observaciones` LONGTEXT NULL,
    `nombre_representante_cliente` VARCHAR(191) NULL,
    `firma_cliente` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_registro_induccion_recorrido` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `fecha` VARCHAR(191) NULL,
    `renglon_edificio` VARCHAR(191) NULL,
    `supervisor_cliente` VARCHAR(191) NULL,
    `supervisor_corporacion` VARCHAR(191) NULL,
    `temas_desarrollados` LONGTEXT NULL,
    `aspectos_especificos` LONGTEXT NULL,
    `participantes` LONGTEXT NULL,
    `firma_supervisor` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_informe_supervision` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `fecha` VARCHAR(191) NULL,
    `piso` VARCHAR(191) NULL,
    `area` VARCHAR(191) NULL,
    `aseador` VARCHAR(191) NULL,
    `supervisor` VARCHAR(191) NULL,
    `limpieza_general` LONGTEXT NULL,
    `cuarto_aseo` LONGTEXT NULL,
    `servicios_sanitarios` LONGTEXT NULL,
    `uniforme_presentacion` LONGTEXT NULL,
    `estado_equipos` LONGTEXT NULL,
    `calificacion_general` LONGTEXT NULL,
    `firma_aseador` LONGTEXT NULL,
    `firma_supervisor` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_guia_uso_cepillo_electrico` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `miscelaneo` VARCHAR(191) NULL,
    `capacitador` VARCHAR(191) NULL,
    `cedula` VARCHAR(191) NULL,
    `fecha` VARCHAR(191) NULL,
    `firma_miscelaneo` LONGTEXT NULL,
    `firma_capacitador` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_listado_general_clientes` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `numero_cliente` VARCHAR(191) NULL,
    `fecha_inicio` VARCHAR(191) NULL,
    `fecha_finalizacion` VARCHAR(191) NULL,
    `extension_prorroga` VARCHAR(191) NULL,
    `nombre_cliente` VARCHAR(191) NULL,
    `area_sede` VARCHAR(191) NULL,
    `numero_corpo` VARCHAR(191) NULL,
    `numero_licitacion` VARCHAR(191) NULL,
    `cantidad_miscelaneos` VARCHAR(191) NULL,
    `tipo_requerimiento_insumos` VARCHAR(191) NULL,
    `tipo_requerimiento_utencilios` VARCHAR(191) NULL,
    `tipo_requerimiento_equipos` VARCHAR(191) NULL,
    `ubicacion` VARCHAR(191) NULL,
    `fecha_reunion_apertura` VARCHAR(191) NULL,
    `necesidades` LONGTEXT NULL,
    `gustos_preferencias` LONGTEXT NULL,
    `supervisor_asignado` VARCHAR(191) NULL,
    `condiciones_licitaciones` LONGTEXT NULL,
    `plan_trabajo` LONGTEXT NULL,
    `encuestas` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
