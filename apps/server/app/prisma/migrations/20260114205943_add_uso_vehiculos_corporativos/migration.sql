/*
  Warnings:

  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `c_bitacora_vehiculo_detenido` ADD COLUMN `uso_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;

-- CreateTable
CREATE TABLE `c_usos_vehiculos_corporativos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bitacora_id` INTEGER NULL,
    `vehiculo_id` INTEGER NOT NULL,
    `nombre_conductor` VARCHAR(55) NOT NULL,
    `fecha` DATETIME NOT NULL,
    `hora_inicio` TIME NOT NULL,
    `hora_fin` TIME NOT NULL,
    `combustible_inicio` INTEGER NOT NULL,
    `combustible_fin` INTEGER NOT NULL,
    `km_inicio` INTEGER NOT NULL,
    `km_fin` INTEGER NOT NULL,
    `motivo` LONGTEXT NOT NULL,
    `firma_responsable` LONGTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_usos_vehiculos_corporativos` ADD CONSTRAINT `c_usos_vehiculos_corporativos_vehiculo_id_fkey` FOREIGN KEY (`vehiculo_id`) REFERENCES `c_vehiculos_corporativos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
