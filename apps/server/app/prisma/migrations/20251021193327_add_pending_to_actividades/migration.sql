/*
  Warnings:

  - Added the required column `updated_at` to the `e_actividad_corpo_marcada` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `e_actividad_corpo_revision_equipo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `e_actividad_corpo` MODIFY `frecuencia` LONGTEXT NOT NULL;

-- AlterTable
ALTER TABLE `e_actividad_corpo_marcada` ADD COLUMN `pendiente` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `e_actividad_corpo_revision_equipo` ADD COLUMN `pendiente` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;
