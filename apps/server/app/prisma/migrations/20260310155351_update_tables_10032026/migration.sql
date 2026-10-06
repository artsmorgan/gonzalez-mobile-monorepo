/*
  Warnings:

  - You are about to drop the column `file_name` on the `c_solicitud_permiso` table. All the data in the column will be lost.
  - You are about to drop the column `numero_serie` on the `e_activo_visitante` table. All the data in the column will be lost.
  - You are about to drop the `c_puesto_notas_bitacora_cambios` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `firma_responsable` to the `c_puesto_notas` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nombre` to the `e_activo_visitante` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numero_id` to the `e_activo_visitante` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `c_puesto_notas_bitacora_cambios` DROP FOREIGN KEY `c_puesto_notas_bitacora_cambios_empleado_id_fkey`;

-- DropForeignKey
ALTER TABLE `c_puesto_notas_bitacora_cambios` DROP FOREIGN KEY `c_puesto_notas_bitacora_cambios_nota_id_fkey`;

-- AlterTable
ALTER TABLE `c_puesto_notas` ADD COLUMN `firma_manual_responsable` LONGTEXT NULL,
    ADD COLUMN `firma_responsable` LONGTEXT NOT NULL,
    ADD COLUMN `is_modified` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `c_solicitud_permiso` DROP COLUMN `file_name`;

-- AlterTable
ALTER TABLE `e_activo_visitante` DROP COLUMN `numero_serie`,
    ADD COLUMN `nombre` VARCHAR(50) NOT NULL,
    ADD COLUMN `numero_id` VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE `e_registro_personas` ADD COLUMN `dep_pers_visita` VARCHAR(75) NULL;

-- DropTable
DROP TABLE `c_puesto_notas_bitacora_cambios`;

-- CreateTable
CREATE TABLE `c_imagenes_puesto_notas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `nota_id` INTEGER NOT NULL,

    INDEX `c_imagenes_puesto_notas_id_fkey`(`nota_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `c_imagenes_solicitud_permiso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `solicitud_id` INTEGER NOT NULL,
    `original_name` LONGTEXT NOT NULL,

    INDEX `c_imagenes_solicitud_permiso_id_fkey`(`solicitud_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_imagenes_puesto_notas` ADD CONSTRAINT `c_imagenes_puesto_notas_nota_id_fkey` FOREIGN KEY (`nota_id`) REFERENCES `c_puesto_notas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_imagenes_solicitud_permiso` ADD CONSTRAINT `c_imagenes_solicitud_permiso_solicitud_id_fkey` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_permiso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
