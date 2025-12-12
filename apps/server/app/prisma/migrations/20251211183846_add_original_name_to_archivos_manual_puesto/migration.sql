/*
  Warnings:

  - You are about to alter the column `created_at` on the `c_evaluacion_empleado` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - Added the required column `original_name` to the `e_archivos_manual_puesto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_evaluacion_empleado` MODIFY `created_at` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `e_archivos_manual_puesto` ADD COLUMN `original_name` LONGTEXT NOT NULL;
