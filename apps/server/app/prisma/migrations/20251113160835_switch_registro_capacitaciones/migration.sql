/*
  Warnings:

  - You are about to alter the column `created_at` on the `c_evaluacion_empleado` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to drop the column `cedula_empleado` on the `e_registro_capacitaciones` table. All the data in the column will be lost.
  - You are about to drop the column `empleado_id` on the `e_registro_capacitaciones` table. All the data in the column will be lost.
  - You are about to drop the column `nombre_empleado` on the `e_registro_capacitaciones` table. All the data in the column will be lost.
  - You are about to drop the column `puesto_id` on the `e_registro_capacitaciones` table. All the data in the column will be lost.
  - You are about to alter the column `hora_entrada` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_entrada` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - Added the required column `file` to the `e_registro_capacitaciones` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipo` to the `e_registro_capacitaciones` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `e_registro_capacitaciones` DROP FOREIGN KEY `e_registro_capacitaciones_puesto_id_fkey`;

-- DropIndex
DROP INDEX `e_registro_capacitaciones_puesto_id_fkey` ON `e_registro_capacitaciones`;

-- AlterTable
ALTER TABLE `c_evaluacion_empleado` MODIFY `created_at` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_registro_capacitaciones` DROP COLUMN `cedula_empleado`,
    DROP COLUMN `empleado_id`,
    DROP COLUMN `nombre_empleado`,
    DROP COLUMN `puesto_id`,
    ADD COLUMN `file` LONGTEXT NOT NULL,
    ADD COLUMN `tipo` VARCHAR(15) NOT NULL,
    MODIFY `resultado` VARCHAR(15) NULL;

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
CREATE TABLE `e_capacitacion_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `capacitacion_id` INTEGER NOT NULL,
    `empleado_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_capacitacion_puesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `capacitacion_id` INTEGER NOT NULL,
    `puesto_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `e_capacitacion_empleado` ADD CONSTRAINT `e_capacitacion_empleado_capacitacion_id_fkey` FOREIGN KEY (`capacitacion_id`) REFERENCES `e_registro_capacitaciones`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_capacitacion_empleado` ADD CONSTRAINT `e_capacitacion_empleado_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `c_empleado`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_capacitacion_puesto` ADD CONSTRAINT `e_capacitacion_puesto_capacitacion_id_fkey` FOREIGN KEY (`capacitacion_id`) REFERENCES `e_registro_capacitaciones`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_capacitacion_puesto` ADD CONSTRAINT `e_capacitacion_puesto_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
