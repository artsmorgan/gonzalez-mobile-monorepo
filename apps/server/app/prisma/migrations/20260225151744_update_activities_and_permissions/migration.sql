/*
  Warnings:

  - You are about to drop the column `cliente_id` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `codigo` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `codigo_sustituto` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `contrato` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `contrato_id` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `corpo_id` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `division` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `empresa_id` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `fecha_solicitud` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `firma_encargado_monitoreo` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `firma_gerente` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `firma_responsables` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `horario` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `motivo_permiso` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `permiso_coordinado_por` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `permiso_sustituido_por` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `persona_solicita` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `plaza_id` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `puesto_id` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to alter the column `created_by` on the `c_solicitud_permiso` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to drop the `e_actividad_corpo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `e_actividad_corpo_plaza` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `e_actividad_corpo_revision_equipo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `e_actividad_puesto_plaza` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `ejecutivo_cuenta` to the `c_solicitud_permiso` table without a default value. This is not possible if the table is not empty.
  - Added the required column `empleado_id` to the `c_solicitud_permiso` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fecha_fin` to the `c_solicitud_permiso` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fecha_inicio` to the `c_solicitud_permiso` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firma_responsable` to the `c_solicitud_permiso` table without a default value. This is not possible if the table is not empty.
  - Added the required column `turnos` to the `c_solicitud_permiso` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `e_actividad_corpo` DROP FOREIGN KEY `e_actividad_corpo_cliente_id_fkey`;

-- DropForeignKey
ALTER TABLE `e_actividad_corpo` DROP FOREIGN KEY `e_actividad_corpo_contrato_id_fkey`;

-- DropForeignKey
ALTER TABLE `e_actividad_corpo` DROP FOREIGN KEY `e_actividad_corpo_corpo_id_fkey`;

-- DropForeignKey
ALTER TABLE `e_actividad_corpo` DROP FOREIGN KEY `e_actividad_corpo_empresa_id_fkey`;

-- DropForeignKey
ALTER TABLE `e_actividad_corpo` DROP FOREIGN KEY `e_actividad_corpo_plaza_id_fkey`;

-- DropForeignKey
ALTER TABLE `e_actividad_corpo` DROP FOREIGN KEY `e_actividad_corpo_puesto_id_fkey`;

-- DropForeignKey
ALTER TABLE `e_actividad_corpo_plaza` DROP FOREIGN KEY `e_actividad_corpo_plaza_actividadCorpo_id_fkey`;

-- DropForeignKey
ALTER TABLE `e_actividad_corpo_plaza` DROP FOREIGN KEY `e_actividad_corpo_plaza_plaza_id_fkey`;

-- DropForeignKey
ALTER TABLE `e_actividad_corpo_revision_equipo` DROP FOREIGN KEY `e_actividad_corpo_revision_equipo_actividadCorpoPlaza_id_fkey`;

-- DropForeignKey
ALTER TABLE `e_actividad_corpo_revision_equipo` DROP FOREIGN KEY `e_actividad_corpo_revision_equipo_articulo_id_fkey`;

-- DropForeignKey
ALTER TABLE `e_actividad_puesto_plaza` DROP FOREIGN KEY `e_actividad_puesto_plaza_actividadCorpo_id_fkey`;

-- AlterTable
ALTER TABLE `c_solicitud_permiso` DROP COLUMN `cliente_id`,
    DROP COLUMN `codigo`,
    DROP COLUMN `codigo_sustituto`,
    DROP COLUMN `contrato`,
    DROP COLUMN `contrato_id`,
    DROP COLUMN `corpo_id`,
    DROP COLUMN `division`,
    DROP COLUMN `empresa_id`,
    DROP COLUMN `fecha_solicitud`,
    DROP COLUMN `firma_encargado_monitoreo`,
    DROP COLUMN `firma_gerente`,
    DROP COLUMN `firma_responsables`,
    DROP COLUMN `horario`,
    DROP COLUMN `motivo_permiso`,
    DROP COLUMN `permiso_coordinado_por`,
    DROP COLUMN `permiso_sustituido_por`,
    DROP COLUMN `persona_solicita`,
    DROP COLUMN `plaza_id`,
    DROP COLUMN `puesto_id`,
    ADD COLUMN `comentarios` LONGTEXT NULL,
    ADD COLUMN `ejecutivo_cuenta` INTEGER NOT NULL,
    ADD COLUMN `empleado_id` INTEGER NOT NULL,
    ADD COLUMN `fecha_fin` DATETIME(0) NOT NULL,
    ADD COLUMN `fecha_inicio` DATETIME(0) NOT NULL,
    ADD COLUMN `file_name` VARCHAR(255) NULL,
    ADD COLUMN `firma_ejecutivo_cuenta_digital` LONGTEXT NULL,
    ADD COLUMN `firma_ejecutivo_cuenta_manual` LONGTEXT NULL,
    ADD COLUMN `firma_responsable` LONGTEXT NOT NULL,
    ADD COLUMN `reemplazo_obligatorio` INTEGER NULL,
    ADD COLUMN `turnos` LONGTEXT NOT NULL,
    MODIFY `created_by` INTEGER NOT NULL;

-- DropTable
DROP TABLE `e_actividad_corpo`;

-- DropTable
DROP TABLE `e_actividad_corpo_plaza`;

-- DropTable
DROP TABLE `e_actividad_corpo_revision_equipo`;

-- DropTable
DROP TABLE `e_actividad_puesto_plaza`;

-- CreateTable
CREATE TABLE `e_actividades` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_actividad` VARCHAR(255) NOT NULL,
    `fecha_inicio` DATE NOT NULL,
    `frecuencia` LONGTEXT NOT NULL,
    `es_revision_equipo` BOOLEAN NOT NULL,
    `descripcion_actividad` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_actividades_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actividad_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,

    INDEX `e_actividad_id_fkey`(`actividad_id`),
    INDEX `e_actividad_puesto_id_fkey`(`puesto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_actividades_puesto_plaza` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actividad_puesto_id` INTEGER NOT NULL,
    `plaza_id` INTEGER NOT NULL,
    `bitacora` LONGTEXT NOT NULL,
    `file_name` LONGTEXT NULL,
    `articles` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `marcada` BOOLEAN NOT NULL DEFAULT false,

    INDEX `e_actividad_actividad_puesto_id_fkey`(`actividad_puesto_id`),
    INDEX `e_actividad_puesto_plaza_id_fkey`(`plaza_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_solicitud_permiso` ADD CONSTRAINT `c_solicitud_permiso_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividades_puesto` ADD CONSTRAINT `e_actividades_puesto_actividad_id_fkey` FOREIGN KEY (`actividad_id`) REFERENCES `e_actividades`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividades_puesto` ADD CONSTRAINT `e_actividades_puesto_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividades_puesto_plaza` ADD CONSTRAINT `e_actividades_puesto_plaza_actividad_puesto_id_fkey` FOREIGN KEY (`actividad_puesto_id`) REFERENCES `e_actividades_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_actividades_puesto_plaza` ADD CONSTRAINT `e_actividades_puesto_plaza_plaza_id_fkey` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
