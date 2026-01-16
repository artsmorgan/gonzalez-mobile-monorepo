/*
  Warnings:

  - You are about to alter the column `created_at` on the `e_mutuos_acuerdos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `e_mutuos_acuerdos` MODIFY `created_at` DATETIME NOT NULL;

-- CreateTable
CREATE TABLE `e_archivos_producto_no_conforme` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` LONGTEXT NOT NULL,
    `type` VARCHAR(25) NOT NULL,
    `extension` VARCHAR(25) NOT NULL,
    `pnc_id` INTEGER NOT NULL,
    `original_name` LONGTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `e_archivos_producto_no_conforme` ADD CONSTRAINT `e_archivos_producto_no_conforme_pnc_id_fkey` FOREIGN KEY (`pnc_id`) REFERENCES `c_producto_no_conforme`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
