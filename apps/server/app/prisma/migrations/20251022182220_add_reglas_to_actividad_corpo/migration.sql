/*
  Warnings:

  - Added the required column `reglas` to the `e_actividad_corpo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `e_actividad_corpo` ADD COLUMN `reglas` LONGTEXT NOT NULL;
