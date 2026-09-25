/*
  Warnings:

  - Added the required column `tipo` to the `c_solicitud_permiso` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `c_solicitud_permiso` ADD COLUMN `tipo` VARCHAR(15) NOT NULL;
