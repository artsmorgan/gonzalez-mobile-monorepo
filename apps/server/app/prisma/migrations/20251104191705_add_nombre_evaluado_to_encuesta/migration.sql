/*
  Warnings:

  - You are about to drop the column `mejoras` on the `c_encuesta_cliente` table. All the data in the column will be lost.
  - You are about to alter the column `created_at` on the `c_evaluacion_empleado` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_entrada` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_personas` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_entrada` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `hora_salida` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `created_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `e_registro_vehiculos` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `c_encuesta_cliente` DROP COLUMN `mejoras`,
    ADD COLUMN `nombre_evaluado` VARCHAR(45) NULL;

-- AlterTable
ALTER TABLE `c_evaluacion_empleado` MODIFY `created_at` DATETIME NOT NULL;

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
