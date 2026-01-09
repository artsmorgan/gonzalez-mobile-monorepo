/*
  Warnings:

  - Added the required column `firma_responsable` to the `e_control_documento_entregado_cliente` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `e_control_documento_entregado_cliente` ADD COLUMN `firma_responsable` LONGTEXT NOT NULL;
