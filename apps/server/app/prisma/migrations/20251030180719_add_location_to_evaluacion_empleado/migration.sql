/*
  Warnings:

  - You are about to alter the column `created_at` on the `c_evaluacion_empleado` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_entrada` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_entrada` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - Added the required column `corpo_id` to the `c_evaluacion_empleado` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plaza_id` to the `c_evaluacion_empleado` table without a default value. This is not possible if the table is not empty.
  - Added the required column `puesto_id` to the `c_evaluacion_empleado` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_evaluacion_empleado` ADD COLUMN `corpo_id` INTEGER NOT NULL,
    ADD COLUMN `plaza_id` INTEGER NOT NULL,
    ADD COLUMN `puesto_id` INTEGER NOT NULL,
    MODIFY `created_at` DATETIME NOT NULL;

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

-- AddForeignKey
ALTER TABLE `c_evaluacion_empleado` ADD CONSTRAINT `c_evaluacion_empleado_corpo_id_fkey` FOREIGN KEY (`corpo_id`) REFERENCES `e_estructura_sucursal`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_evaluacion_empleado` ADD CONSTRAINT `c_evaluacion_empleado_puesto_id_fkey` FOREIGN KEY (`puesto_id`) REFERENCES `e_estructura_puesto`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `c_evaluacion_empleado` ADD CONSTRAINT `c_evaluacion_empleado_plaza_id_fkey` FOREIGN KEY (`plaza_id`) REFERENCES `e_estructura_plazas`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
