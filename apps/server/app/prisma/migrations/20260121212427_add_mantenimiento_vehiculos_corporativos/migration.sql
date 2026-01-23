/*
  Warnings:

  - You are about to alter the column `fecha` on the `c_checklist_supervision` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `fecha` on the `c_usos_vehiculos_corporativos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `c_checklist_supervision` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `c_usos_vehiculos_corporativos` MODIFY `fecha` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;

-- CreateTable
CREATE TABLE `c_mantenimiento_vehiculos_corporativos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehiculo_id` INTEGER NOT NULL,
    `fecha` DATETIME NOT NULL,
    `tipo` VARCHAR(25) NOT NULL,
    `mantenimiento` LONGTEXT NOT NULL,
    `diagnostico` LONGTEXT NOT NULL,
    `kilometraje_siguiente_revision` INTEGER NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,
    `imagen_antes` LONGTEXT NOT NULL,
    `imagen_despues` LONGTEXT NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_mantenimiento_vehiculos_corporativos` ADD CONSTRAINT `c_mantenimiento_vehiculos_corporativos_vehiculo_id_fkey` FOREIGN KEY (`vehiculo_id`) REFERENCES `c_vehiculos_corporativos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
