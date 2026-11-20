/*
  Warnings:

  - You are about to drop the `c_imagenes_solicitud_permiso` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `c_imagenes_solicitud_permiso` DROP FOREIGN KEY `c_imagenes_solicitud_permiso_solicitud_id_fkey`;

-- DropTable
DROP TABLE `c_imagenes_solicitud_permiso`;

-- CreateTable
CREATE TABLE `c_archivos_solicitud_permiso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `type` VARCHAR(25) NOT NULL,
    `extension` VARCHAR(25) NOT NULL,
    `solicitud_id` INTEGER NOT NULL,
    `original_name` LONGTEXT NOT NULL,
    `is_main` BOOLEAN NOT NULL DEFAULT false,

    INDEX `e_archivos_solicitud_permiso_id_fkey`(`solicitud_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_archivos_solicitud_permiso` ADD CONSTRAINT `c_archivos_solicitud_permiso_solicitud_id_fkey` FOREIGN KEY (`solicitud_id`) REFERENCES `c_solicitud_permiso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
