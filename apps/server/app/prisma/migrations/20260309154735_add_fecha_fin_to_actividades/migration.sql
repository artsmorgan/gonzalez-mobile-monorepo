/*
  Warnings:

  - Added the required column `fecha_fin` to the `e_actividades` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `e_actividades` ADD COLUMN `fecha_fin` DATE NOT NULL;
