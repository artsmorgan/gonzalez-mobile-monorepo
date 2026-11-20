/*
  Warnings:

  - You are about to drop the column `departamento_visita` on the `e_registro_personas` table. All the data in the column will be lost.
  - You are about to drop the column `persona_visita` on the `e_registro_personas` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `e_registro_personas` DROP COLUMN `departamento_visita`,
    DROP COLUMN `persona_visita`;

-- AlterTable
ALTER TABLE `e_registro_vehiculos` ADD COLUMN `departamento_visita` VARCHAR(255) NULL,
    ADD COLUMN `persona_visita` VARCHAR(255) NULL;
