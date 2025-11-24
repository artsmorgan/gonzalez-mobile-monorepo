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
ALTER TABLE `c_plan_trabajo_aseo_limpieza` ADD COLUMN `ubicacion` VARCHAR(191) NULL;

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
CREATE TABLE `c_control_acciones_mejora` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `numero_accion` VARCHAR(191) NULL,
    `causa_origen` LONGTEXT NULL,
    `fecha_deteccion_incidencia` VARCHAR(191) NULL,
    `mes_deteccion` VARCHAR(191) NULL,
    `tipo_accion` VARCHAR(191) NULL,
    `proceso_relacionado` LONGTEXT NULL,
    `encargado_proceso` VARCHAR(191) NULL,
    `origen_accion` VARCHAR(191) NULL,
    `fecha_elaboracion_plan` VARCHAR(191) NULL,
    `tiempo_plan_vs_deteccion` VARCHAR(191) NULL,
    `plan_elaborado_a_tiempo` VARCHAR(191) NULL,
    `detalle_nc_opr_dm` LONGTEXT NULL,
    `analisis_causas` LONGTEXT NULL,
    `accion_inmediata` LONGTEXT NULL,
    `accion_mejora` LONGTEXT NULL,
    `fecha_aprobacion` VARCHAR(191) NULL,
    `responsable_ejecucion` VARCHAR(191) NULL,
    `fecha_programada_ejecucion` VARCHAR(191) NULL,
    `fecha_real_ejecucion` VARCHAR(191) NULL,
    `mes_ejecucion` VARCHAR(191) NULL,
    `modif_fecha_ejecucion_motivo` LONGTEXT NULL,
    `aplica_seguimiento` VARCHAR(191) NULL,
    `seguimiento_meses` LONGTEXT NULL,
    `evidencias` LONGTEXT NULL,
    `estado_accion` VARCHAR(191) NULL,
    `a_tiempo` VARCHAR(191) NULL,
    `no_conformidades_similares` VARCHAR(191) NULL,
    `reincidencia` VARCHAR(191) NULL,
    `actualiza_matriz_riesgos` VARCHAR(191) NULL,
    `efectividad` VARCHAR(191) NULL,
    `no_efectiva` VARCHAR(191) NULL,
    `cambiar_al_8d` VARCHAR(191) NULL,
    `cerrada` VARCHAR(191) NULL,
    `dueño_proceso` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_politica_calidad` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `politica_contenido` LONGTEXT NULL,
    `nombre_aprobado` VARCHAR(191) NULL,
    `firma_aprobado` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_objetivos_empresariales_calidad` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `ambitos` LONGTEXT NULL,
    `nombre_aprobado` VARCHAR(191) NULL,
    `firma_aprobado` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_matriz_analisis_partes_interesadas` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `partes_interesadas` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_plan_comunicacion` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `comunicaciones` LONGTEXT NULL,
    `responsable_aprobacion` VARCHAR(191) NULL,
    `puesto_aprobacion` VARCHAR(191) NULL,
    `fecha_aprobacion` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_matriz_gestion_conocimiento` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `registros` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_planificacion_cambios_sgc` (
    `id` VARCHAR(191) NOT NULL,
    `empresa_id` VARCHAR(191) NULL,
    `cliente_id` VARCHAR(191) NULL,
    `contrato_id` VARCHAR(191) NULL,
    `corpo_id` VARCHAR(191) NULL,
    `puesto_id` VARCHAR(191) NULL,
    `plaza_id` VARCHAR(191) NULL,
    `datos_cambio` LONGTEXT NULL,
    `actividades` LONGTEXT NULL,
    `aprobado_por` VARCHAR(191) NULL,
    `firma_representante` LONGTEXT NULL,
    `fecha_aprobacion` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
