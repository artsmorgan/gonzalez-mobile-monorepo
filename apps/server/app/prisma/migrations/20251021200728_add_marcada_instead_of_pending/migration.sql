/*
  Warnings:

  - You are about to drop the column `pendiente` on the `e_actividad_corpo_marcada` table. All the data in the column will be lost.
  - You are about to drop the column `pendiente` on the `e_actividad_corpo_revision_equipo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `e_actividad_corpo_marcada` DROP COLUMN `pendiente`,
    ADD COLUMN `marcada` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `e_actividad_corpo_revision_equipo` DROP COLUMN `pendiente`,
    ADD COLUMN `marcada` BOOLEAN NOT NULL DEFAULT false;
