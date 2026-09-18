/*
  Warnings:

  - Added the required column `firma_recibe` to the `e_registro_entrega_puesto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `e_registro_entrega_puesto` ADD COLUMN `firma_recibe` LONGTEXT NOT NULL;
