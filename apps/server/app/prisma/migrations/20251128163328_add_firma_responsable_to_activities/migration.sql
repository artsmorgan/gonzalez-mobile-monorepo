/*
  Warnings:

  - Added the required column `firma_responsable` to the `e_actividad_corpo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `e_actividad_corpo` ADD COLUMN `firma_responsable` LONGTEXT NOT NULL;
