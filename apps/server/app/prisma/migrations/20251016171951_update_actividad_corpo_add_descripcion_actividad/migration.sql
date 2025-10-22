/*
  Warnings:

  - Added the required column `descripcion_actividad` to the `e_actividad_corpo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `e_actividad_corpo` ADD COLUMN `descripcion_actividad` LONGTEXT NOT NULL,
    MODIFY `nombre_actividad` VARCHAR(255) NOT NULL;
