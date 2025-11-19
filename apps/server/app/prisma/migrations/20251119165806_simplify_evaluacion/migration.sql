/*
  Warnings:

  - You are about to alter the column `hora_entrada` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_entrada` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to drop the `c_evaluacion_empleado` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `c_evaluacion_empleado` DROP FOREIGN KEY `c_evaluacion_empleado_corpo_id_fkey`;

-- DropForeignKey
ALTER TABLE `c_evaluacion_empleado` DROP FOREIGN KEY `c_evaluacion_empleado_plaza_id_fkey`;

-- DropForeignKey
ALTER TABLE `c_evaluacion_empleado` DROP FOREIGN KEY `c_evaluacion_empleado_puesto_id_fkey`;

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

-- DropTable
DROP TABLE `c_evaluacion_empleado`;

-- CreateTable
CREATE TABLE `c_evaluacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `corpo_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,
    `plaza_id` INTEGER NOT NULL,
    `tipo` LONGTEXT NOT NULL,
    `evaluation` LONGTEXT NOT NULL,
    `firma_evaluador` LONGTEXT NOT NULL,
    `created_at` DATETIME NOT NULL,
    `created_by` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `c_evaluacion` ADD CONSTRAINT `c_evaluacion_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_evaluacion` ADD CONSTRAINT `c_evaluacion_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_evaluacion` ADD CONSTRAINT `c_evaluacion_plaza_id_fkey` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
