/*
  Warnings:

  - You are about to alter the column `created_at` on the `c_evaluacion_empleado` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `c_evaluacion_empleado` MODIFY `created_at` DATETIME NOT NULL;

-- CreateTable
CREATE TABLE `e_puestos_manual_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `manual_puesto_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `e_puestos_manual_puesto` ADD CONSTRAINT `e_puestos_manual_puesto_manual_puesto_id_fkey` FOREIGN KEY (`manual_puesto_id`) REFERENCES `e_manual_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_puestos_manual_puesto` ADD CONSTRAINT `e_puestos_manual_puesto_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
