/*
  Warnings:

  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;

-- CreateTable
CREATE TABLE `c_imagenes_vehiculos_corporativos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `vehiculo_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_imagenes_vehiculos_corporativos` ADD CONSTRAINT `c_imagenes_vehiculos_corporativos_vehiculo_id_fkey` FOREIGN KEY (`vehiculo_id`) REFERENCES `c_vehiculos_corporativos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
